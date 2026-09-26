import { beforeAll, describe, expect, it } from "vitest";
import { couponsService } from "@/modules/coupons/service";
import { ordersService } from "@/modules/orders/service";
import { withTx } from "@/lib/db";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createCoupon } from "../../factories/commerce";
import { buildContext } from "@/lib/authz/context";
import { money } from "@/lib/money";

describe("first purchase only coupon restriction (docs/06 §2.3, A-401)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("permits coupon on first purchase, rejects once customer has a paid order", async () => {
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

    const coupon = await createCoupon({
      code: "WELCOME10",
      kind: "percent",
      value: 1000, // 10%
      firstPurchaseOnly: true,
      createdBy: admin.id,
    });

    const ctx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust-fp" },
      roles: ["user"],
    });

    // 1. First validation should succeed
    const valid1 = await couponsService.validateForOrder({
      code: "WELCOME10",
      userId: customer.id,
      productId: product.id,
      subtotal: money(10000, "INR"),
    });

    expect(valid1.valid).toBe(true);
    if (valid1.valid) {
      expect(valid1.discountMinor).toBe(1000);
    }

    // 2. Place order and mark paid
    const orderRes = await ordersService.createOrder(ctx, {
      offeringId: offering.id,
      couponCode: "WELCOME10",
      paymentMethod: "manual_upi",
      billing: {
        name: "Test Customer",
        email: customer.email,
        country: "IN",
      },
    });

    await withTx(async (tx) => {
      await ordersService.markPaid(orderRes.orderId, new Date(), tx);
    });

    // 3. Second validation for the same user should now fail with first_purchase_only
    const valid2 = await couponsService.validateForOrder({
      code: "WELCOME10",
      userId: customer.id,
      productId: product.id,
      subtotal: money(10000, "INR"),
    });

    expect(valid2.valid).toBe(false);
    if (!valid2.valid) {
      expect(valid2.reason).toBe("first_purchase_only");
    }
  });
});
