/** `coupons` Server Actions (docs/06 API-COM-08) — `orders.manual.write`, audited in-tx. */
import { defineAction } from "@/lib/actions/envelope";
import { couponsService } from "./service";
import { deactivateCouponInput, upsertCouponInput } from "./types";

export const upsertCoupon = defineAction({
  name: "API-COM-08 coupon.upsert",
  input: upsertCouponInput,
  permission: "orders.manual.write",
  handler: (input, ctx) => couponsService.upsertCoupon(ctx, input),
});

export const deactivateCoupon = defineAction({
  name: "API-COM-08 coupon.deactivate",
  input: deactivateCouponInput,
  permission: "orders.manual.write",
  handler: (input, ctx) => couponsService.deactivateCoupon(ctx, input),
});
