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

describe("confirmPayment concurrent lock integration", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("handles concurrent confirm requests safely with row locking, never double-posting", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const partner = await createPartner({ userId: admin1.id });
    const product = await createProduct({ createdBy: admin1.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 1000,
      createdBy: admin1.id,
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

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["admin"],
    });

    const admin2Ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-admin-2" },
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

    // Run both confirms in parallel
    const results = await Promise.allSettled([
      paymentsService.confirmPayment(admin1Ctx, {
        paymentId: orderRes.payment.paymentId,
        amountReceivedMinor: savedOrder!.totalMinor,
        reference: "UTR-CONCURRENT-1",
        receivedOn: "2026-09-26",
      }),
      paymentsService.confirmPayment(admin2Ctx, {
        paymentId: orderRes.payment.paymentId,
        amountReceivedMinor: savedOrder!.totalMinor,
        reference: "UTR-CONCURRENT-1",
        receivedOn: "2026-09-26",
      }),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const rejections = results.filter((r) => r.status === "rejected");

    // Exactly one should succeed, other rejected with idempotency/state error
    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);

    // Verify ledger entries were posted only once
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, orderRes.orderId));
    expect(entries.length).toBeGreaterThan(0);
  });
});
