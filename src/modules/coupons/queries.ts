/** `coupons` read models (docs/06 API-COM-08 `listCoupons`). */
import { defineAction } from "@/lib/actions/envelope";
import { couponsService } from "./service";
import { listCouponsInput } from "./types";

export const listCoupons = defineAction({
  name: "API-COM-08 coupon.list",
  input: listCouponsInput,
  permission: "orders.manual.write",
  handler: (input, ctx) => couponsService.listCoupons(ctx, input),
});
