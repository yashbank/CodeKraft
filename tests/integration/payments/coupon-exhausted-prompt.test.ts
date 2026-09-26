import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { couponsService } from "@/modules/coupons/service";
import { coupons, orders } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("confirmPayment coupon exhausted prompt integration", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("prompts admin to confirm with dropCoupon when coupon limit is exceeded, then succeeds with dropCoupon: true", async () => {
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

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const custCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["user"],
    });

    // Create coupon with maxRedemptions = 1
    const { coupon } = await couponsService.upsertCoupon(adminCtx, {
      code: "LIMITED1",
      kind: "fixed",
      value: 2000,
      currency: "INR",
      maxRedemptions: 1,
      firstPurchaseOnly: false,
      active: true,
    });

    // Customer creates order using LIMITED1
    const orderRes = await ordersService.createOrder(custCtx, {
      offeringId: offering.id,
      couponCode: "LIMITED1",
      paymentMethod: "manual_upi",
      billing: { name: "Cust", email: customer.email, country: "IN" },
    });

    // Exhaust coupon beforehand
    await db.update(coupons).set({ redemptionsCount: 1 }).where(eq(coupons.id, coupon.id));

    const [savedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderRes.orderId));

    // Confirming should fail with coupon limit exceeded prompt
    await expect(
      paymentsService.confirmPayment(adminCtx, {
        paymentId: orderRes.payment.paymentId,
        amountReceivedMinor: savedOrder!.totalMinor,
        reference: "UTR-COUPON-EXH",
        receivedOn: "2026-09-26",
      }),
    ).rejects.toThrow("Coupon limit exceeded. Confirm without coupon using dropCoupon: true.");

    // Admin re-runs with dropCoupon: true
    const confirmRes = await paymentsService.confirmPayment(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      amountReceivedMinor: 10000, // full price
      reference: "UTR-COUPON-EXH",
      receivedOn: "2026-09-26",
      dropCoupon: true,
    });

    expect(confirmRes.payment.status).toBe("confirmed");
    expect(confirmRes.order.status).toBe("paid");
  });
});
