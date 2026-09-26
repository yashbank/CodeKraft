import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { orders } from "../../../drizzle/schema/commerce";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("confirmPayment idempotency integration (docs/06 §1.5)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("returns IDEMPOTENT_REPLAY when confirmed twice with identical values", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 1000,
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
      paymentMethod: "manual_upi",
      billing: { name: "Cust", email: customer.email, country: "IN" },
    });

    const [savedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderRes.orderId));

    // First confirmation
    await paymentsService.confirmPayment(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      amountReceivedMinor: savedOrder!.totalMinor,
      reference: "UTR-IDEM-1",
      receivedOn: "2026-09-26",
    });

    // Count ledger entries after first confirm
    const entries1 = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, orderRes.orderId));

    // Second confirmation with same values throws IDEMPOTENT_REPLAY
    await expect(
      paymentsService.confirmPayment(adminCtx, {
        paymentId: orderRes.payment.paymentId,
        amountReceivedMinor: savedOrder!.totalMinor,
        reference: "UTR-IDEM-1",
        receivedOn: "2026-09-26",
      }),
    ).rejects.toThrow("Payment already confirmed");

    // Count ledger entries again - no double posting
    const entries2 = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, orderRes.orderId));
    expect(entries2.length).toBe(entries1.length);
  });
});
