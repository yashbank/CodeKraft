/**
 * Coupon validity (docs/06 API-COM-01/02 `VALIDATION` reasons, A-401, D-409). Pure: takes the row
 * and the facts (clock, buyer's paid-order count) and returns the reason or the discount.
 */
import type { Money } from "@/lib/money";
import { type Coupon, type CouponRejectReason, type CouponValidation, computeCouponDiscount } from "./types";

export interface CouponFacts {
  at: Date;
  /** Paid orders of the buyer (only `paid`-class statuses count for `first_purchase_only`). */
  buyerPaidOrders: number;
  productId: string;
  subtotal: Money;
}

export function rejectionReason(coupon: Coupon, facts: CouponFacts): CouponRejectReason | null {
  if (!coupon.active) return "inactive";
  if (coupon.startsAt !== null && coupon.startsAt.getTime() > facts.at.getTime()) return "not_started";
  if (coupon.endsAt !== null && coupon.endsAt.getTime() <= facts.at.getTime()) return "expired";
  if (coupon.maxRedemptions !== null && coupon.redemptionsCount >= coupon.maxRedemptions) return "exhausted";
  if (coupon.productIds !== null && coupon.productIds.length > 0 && !coupon.productIds.includes(facts.productId)) {
    return "product_restricted";
  }
  if (coupon.kind === "fixed" && coupon.currency !== null && coupon.currency !== facts.subtotal.currency) {
    return "currency_mismatch";
  }
  if (coupon.firstPurchaseOnly && facts.buyerPaidOrders > 0) return "first_purchase_only";
  return null;
}

export function evaluateCoupon(coupon: Coupon | null, facts: CouponFacts): CouponValidation {
  if (coupon === null) return { valid: false, reason: "not_found" };
  const reason = rejectionReason(coupon, facts);
  if (reason !== null) return { valid: false, reason };
  return {
    valid: true,
    coupon: { id: coupon.id, code: coupon.code, kind: coupon.kind, value: coupon.value },
    discountMinor: computeCouponDiscount(coupon.kind, coupon.value, facts.subtotal),
  };
}
