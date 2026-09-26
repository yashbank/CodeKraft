import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ordersService } from "@/modules/orders/service";
import { payments, orders } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";

describe("retryPayment integration (API-COM-04, docs/06 §2.3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("creates a new payment handle with manual_bank method when retrying", async () => {
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
      price: { amountMinor: 5000, currency: "INR" },
    });

    const ctx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust-retry" },
      roles: ["user"],
    });

    // 1. Initial order created with manual_upi
    const orderRes = await ordersService.createOrder(ctx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: {
        name: "Test Customer",
        email: customer.email,
        country: "IN",
      },
    });

    // 2. Retry payment choosing manual_bank
    const retryRes = await ordersService.retryPayment(ctx, {
      orderId: orderRes.orderId,
      paymentMethod: "manual_bank",
    });

    expect(retryRes.payment.method).toBe("manual_bank");
    expect(retryRes.payment.paymentId).not.toBe(orderRes.payment.paymentId);

    // Verify 2 payments exist in DB for this order
    const dbPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderRes.orderId));
    expect(dbPayments).toHaveLength(2);
  });

  it("rejects retryPayment if order has already expired", async () => {
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
      price: { amountMinor: 5000, currency: "INR" },
    });

    const ctx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust-retry-exp" },
      roles: ["user"],
    });

    const orderRes = await ordersService.createOrder(ctx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: {
        name: "Test Customer",
        email: customer.email,
        country: "IN",
      },
    });

    // Backdate expiresAt to past
    await db
      .update(orders)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(orders.id, orderRes.orderId));

    await expect(
      ordersService.retryPayment(ctx, {
        orderId: orderRes.orderId,
        paymentMethod: "manual_upi",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.ORDER_EXPIRED,
    });
  });
});
