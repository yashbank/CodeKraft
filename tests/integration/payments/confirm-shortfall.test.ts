import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { orders, payments } from "../../../drizzle/schema/commerce";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("confirmPayment shortfall integration (SA-24, API-PAY-03)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("records bank_shortfall_minor = 2500 and posts bank_charge before split when received = total - 2500", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 2000,
      createdBy: admin.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 50000, currency: "INR" },
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

    const [savedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderRes.orderId));

    const total = savedOrder!.totalMinor;
    const received = total - 2500;

    const confirmRes = await paymentsService.confirmPayment(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      amountReceivedMinor: received,
      reference: "UTR-SHORTFALL-1",
      receivedOn: "2026-09-26",
    });

    expect(confirmRes.payment.status).toBe("confirmed");
    expect(confirmRes.shortfallMinor).toBe(2500);
    expect(confirmRes.customerCreditMinor).toBe(0);

    const [pmt] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, orderRes.payment.paymentId));
    expect(pmt!.bankShortfallMinor).toBe(2500);
    expect(pmt!.amountReceivedMinor).toBe(received);

    // Verify bank_charge ledger entry was posted
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, orderRes.orderId));

    const bankChargeEntry = entries.find((e) => e.entryType === "bank_charge");
    expect(bankChargeEntry).toBeDefined();
    expect(bankChargeEntry!.amountInrMinor).toBe(2500);
  });
});
