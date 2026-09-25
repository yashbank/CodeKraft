/** Coupons service contract (docs/06 §2.3 API-COM-08 + validation used by API-COM-01/02). */
import type { TxCtx } from "@/lib/db";
import type { RequestContext } from "@/lib/authz/context";
import type { ListResult } from "@/modules/_shared/zod";
import type {
  Coupon,
  CouponValidation,
  DeactivateCouponInput,
  ListCouponsInput,
  UpsertCouponInput,
  ValidateCouponInput,
} from "./types";

export interface CouponsService {
  /** API-COM-08 `upsertCoupon` — `orders.manual.write`; `CONFLICT` on a taken code. */
  upsertCoupon(
    ctx: RequestContext,
    input: UpsertCouponInput,
    tx?: TxCtx,
  ): Promise<{ coupon: Coupon }>;
  /** API-COM-08 `deactivateCoupon`. */
  deactivateCoupon(
    ctx: RequestContext,
    input: DeactivateCouponInput,
    tx?: TxCtx,
  ): Promise<{ coupon: Coupon }>;
  /** API-COM-08 `listCoupons` (query). */
  listCoupons(ctx: RequestContext, input: ListCouponsInput): Promise<ListResult<Coupon>>;

  /**
   * Validation behind API-COM-01/02 (`VALIDATION` invalid/expired/exhausted/not first purchase/
   * product restricted). Pure read; rate class `coupon` (docs/06 §1.7).
   */
  validateForOrder(input: ValidateCouponInput, tx?: TxCtx): Promise<CouponValidation>;

  /**
   * Counted on `paid` (API-COM-02 side effects): `coupon_redemptions` row + `redemptions_count`
   * with a `WHERE redemptions_count < max_redemptions` guard → `LIMIT_EXCEEDED`.
   */
  redeemForOrder(
    couponId: string,
    orderId: string,
    userId: string | null,
    tx: TxCtx,
  ): Promise<void>;
}
