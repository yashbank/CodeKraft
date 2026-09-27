"use server";

/**
 * `coupons` Server Actions (API-COM-08 `upsertCoupon` / `deactivateCoupon`, PHASE-05).
 * All actions are wrapped in defineAction (SA-07).
 *
 * `couponsService` is imported lazily inside each handler (never a static top-level import) --
 * see the comment in `./queries.ts` for why.
 */
import { defineAction } from "@/lib/actions/envelope";
import { deactivateCouponInput, upsertCouponInput } from "./types";

export const upsertCouponAction = defineAction({
  name: "API-COM-08 upsertCoupon",
  input: upsertCouponInput,
  permission: "orders.manual.write",
  handler: async (input, ctx) => {
    const { couponsService } = await import("./service");
    return couponsService.upsertCoupon(ctx, input);
  },
});

export const deactivateCouponAction = defineAction({
  name: "API-COM-08 deactivateCoupon",
  input: deactivateCouponInput,
  permission: "orders.manual.write",
  handler: async (input, ctx) => {
    const { couponsService } = await import("./service");
    return couponsService.deactivateCoupon(ctx, input);
  },
});
