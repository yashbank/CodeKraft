import { beforeAll, describe, expect, it } from "vitest";
import { couponsService } from "@/modules/coupons/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createCoupon } from "../../factories/commerce";
import { money } from "@/lib/money";

describe("product-restricted coupon validation (docs/06 §2.3, A-401)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("applies only to specified product and rejects other products", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const productA = await createProduct({ createdBy: admin.id });
    const productB = await createProduct({ createdBy: admin.id });

    const coupon = await createCoupon({
      code: "PROD20ONLY",
      kind: "percent",
      value: 2000,
      productIds: [productA.id],
      createdBy: admin.id,
    });

    // Valid on productA
    const validOnA = await couponsService.validateForOrder({
      code: "PROD20ONLY",
      userId: customer.id,
      productId: productA.id,
      subtotal: money(10000, "INR"),
    });
    expect(validOnA.valid).toBe(true);

    // Rejected on productB
    const validOnB = await couponsService.validateForOrder({
      code: "PROD20ONLY",
      userId: customer.id,
      productId: productB.id,
      subtotal: money(10000, "INR"),
    });
    expect(validOnB.valid).toBe(false);
    if (!validOnB.valid) {
      expect(validOnB.reason).toBe("product_restricted");
    }
  });
});
