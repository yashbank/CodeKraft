import { beforeAll, describe, expect, it } from "vitest";
import { couponsService } from "@/modules/coupons/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createCoupon } from "../../factories/commerce";
import { money } from "@/lib/money";

describe("expired and inactive coupon rejection (docs/06 §2.3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("rejects expired, not-started, and deactivated coupons", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const product = await createProduct({ createdBy: admin.id });

    // 1. Expired coupon
    const expiredCoupon = await createCoupon({
      code: "EXPIRED50",
      kind: "percent",
      value: 5000,
      endsAt: new Date(Date.now() - 3600_000), // 1 hour ago
      createdBy: admin.id,
    });

    const expRes = await couponsService.validateForOrder({
      code: "EXPIRED50",
      userId: customer.id,
      productId: product.id,
      subtotal: money(10000, "INR"),
    });
    expect(expRes.valid).toBe(false);
    if (!expRes.valid) {
      expect(expRes.reason).toBe("expired");
    }

    // 2. Future coupon (not started)
    const futureCoupon = await createCoupon({
      code: "FUTURE50",
      kind: "percent",
      value: 5000,
      startsAt: new Date(Date.now() + 3600_000), // 1 hour in future
      createdBy: admin.id,
    });

    const futRes = await couponsService.validateForOrder({
      code: "FUTURE50",
      userId: customer.id,
      productId: product.id,
      subtotal: money(10000, "INR"),
    });
    expect(futRes.valid).toBe(false);
    if (!futRes.valid) {
      expect(futRes.reason).toBe("not_started");
    }

    // 3. Deactivated coupon
    const inactiveCoupon = await createCoupon({
      code: "INACTIVE50",
      kind: "percent",
      value: 5000,
      active: false,
      createdBy: admin.id,
    });

    const inactRes = await couponsService.validateForOrder({
      code: "INACTIVE50",
      userId: customer.id,
      productId: product.id,
      subtotal: money(10000, "INR"),
    });
    expect(inactRes.valid).toBe(false);
    if (!inactRes.valid) {
      expect(inactRes.reason).toBe("inactive");
    }
  });
});
