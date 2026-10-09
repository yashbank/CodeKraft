import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { couponsService } from "@/modules/coupons/service";
import { coupons, couponRedemptions } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("coupon exhaustion under concurrent confirmPayment", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("maxRedemptions=1: exactly one of two simultaneous confirms redeems", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const admin2 = await createAdmin();
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
    const adminCtx = (id: string) =>
      buildContext({ user: { id }, session: { id: `s-${id}` }, roles: ["admin"] });

    const { coupon } = await couponsService.upsertCoupon(adminCtx(admin.id), {
      code: "RACEONE1",
      kind: "fixed",
      value: 2000,
      currency: "INR",
      maxRedemptions: 1,
      firstPurchaseOnly: false,
      active: true,
    });

    const placed = [];
    for (const [i, adm] of [admin, admin2].entries()) {
      const customer = await createUser({ emailVerified: true });
      const o = await ordersService.createOrder(
        buildContext({ user: { id: customer.id }, session: { id: `c${i}` }, roles: ["user"] }),
        {
          offeringId: offering.id,
          couponCode: "RACEONE1",
          paymentMethod: "manual_upi",
          billing: { name: "C", email: customer.email, country: "IN" },
        },
      );
      placed.push({ o, adm });
    }

    const results = await Promise.allSettled(
      placed.map(({ o, adm }, i) =>
        paymentsService.confirmPayment(adminCtx(adm.id), {
          paymentId: o.payment.paymentId,
          amountReceivedMinor: 8000,
          reference: `UTR-RACE-${i}`,
          receivedOn: "2026-09-26",
        }),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rej = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(rej.reason?.message)).toMatch(/Coupon limit exceeded/);

    const [row] = await db.select().from(coupons).where(eq(coupons.id, coupon.id));
    expect(row?.redemptionsCount).toBe(1);
    const reds = await db
      .select()
      .from(couponRedemptions)
      .where(eq(couponRedemptions.couponId, coupon.id));
    expect(reds).toHaveLength(1);
  });
});
