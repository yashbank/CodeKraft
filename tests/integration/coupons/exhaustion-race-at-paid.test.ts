import { beforeAll, describe, expect, it } from "vitest";
import { couponsService } from "@/modules/coupons/service";
import { withTx } from "@/lib/db";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createCoupon, createOrder } from "../../factories/commerce";
import { AppError, ErrorCode } from "@/lib/errors";

describe("coupon redemption exhaustion (docs/06 §2.3, S-08)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("permits redemptions up to maxRedemptions and throws LIMIT_EXCEEDED once exhausted", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customerA = await createUser({ emailVerified: true });
    const customerB = await createUser({ emailVerified: true });

    const coupon = await createCoupon({
      code: "ONEONLY10",
      kind: "percent",
      value: 1000,
      maxRedemptions: 1,
      createdBy: admin.id,
    });

    const order1 = await createOrder({ user: customerA });
    const order2 = await createOrder({ user: customerB });

    // First redemption succeeds
    await withTx(async (tx) => {
      await couponsService.redeemForOrder(coupon.id, order1.id, customerA.id, tx);
    });

    // Second redemption should throw LIMIT_EXCEEDED
    await expect(
      withTx(async (tx) => {
        await couponsService.redeemForOrder(coupon.id, order2.id, customerB.id, tx);
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.LIMIT_EXCEEDED,
    });
  });
});
