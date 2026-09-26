import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { orders, payments, userOfferingPurchases } from "../../../drizzle/schema/commerce";
import { ledgerEntries, allocations } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("confirmPayment happy path integration (API-PAY-03)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("confirms payment, marks order paid, records purchase, and posts ledger entries", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 2000, // 20%
      createdBy: admin.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 10000, currency: "INR" },
    });

    const custCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["user"],
    });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const orderRes = await ordersService.createOrder(custCtx, {
      offeringId: offering.id,
      paymentMethod: "manual_bank",
      billing: { name: "Cust", email: customer.email, country: "IN" },
    });

    await paymentsService.submitPaymentReference(custCtx, {
      paymentId: orderRes.payment.paymentId,
      reference: "UTR-BANK-112233",
    });

    const [savedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderRes.orderId));

    const confirmRes = await paymentsService.confirmPayment(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      amountReceivedMinor: savedOrder!.totalMinor,
      reference: "UTR-BANK-112233",
      receivedOn: "2026-09-26",
    });

    expect(confirmRes.payment.status).toBe("confirmed");
    expect(confirmRes.order.status).toBe("paid");
    expect(confirmRes.shortfallMinor).toBe(0);
    expect(confirmRes.customerCreditMinor).toBe(0);
    expect(confirmRes.ledgerEntryCount).toBeGreaterThan(0);

    // Verify user offering purchase recorded
    const [purchase] = await db
      .select()
      .from(userOfferingPurchases)
      .where(eq(userOfferingPurchases.userId, customer.id));
    expect(purchase).toBeDefined();
    expect(purchase!.offeringId).toBe(offering.id);

    // Verify finance ledger entries
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, orderRes.orderId));
    expect(entries.length).toBeGreaterThan(0);

    // Verify allocations
    const allocs = await db
      .select()
      .from(allocations);
    expect(allocs.length).toBeGreaterThan(0);
  });
});
