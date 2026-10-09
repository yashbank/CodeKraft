/**
 * View-model mappers: `modules/coupons` domain shapes -> admin component prop shapes
 * (`components/admin/types`). Kept out of the page components per the phase convention (mapping
 * never lives in a component) and out of the components themselves (they stay props-driven).
 *
 * Known gaps vs. a fully-populated screen -- see the phase report for the full list:
 *  - `state` (active/scheduled/expired/exhausted/inactive) has no backing DB column -- the
 *    `coupons` table only stores `active` (boolean) plus `starts_at`/`ends_at`/`max_redemptions`/
 *    `redemptions_count`. It is derived here in the same precedence `validateForOrder` uses:
 *    inactive > scheduled (not started) > expired > exhausted > active.
 *  - `createdBy` is a user id in the schema, not a name; there is no batched user-name lookup in
 *    scope here (parallels `orders-view.ts`'s partner-name fallback), so it falls back to a short
 *    id (`Admin 3f2a1c9e`).
 *  - `products` (names) requires resolving `productIds` (uuids) against the catalog; the caller
 *    passes a `productNameById` map built from `listProductsAdmin` for this.
 */
import type { Currency } from "@/lib/money";
import type { Coupon } from "@/modules/coupons/types";
import type { CouponRow } from "@/components/admin/types";

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function couponState(coupon: Coupon, now: Date): CouponRow["state"] {
  if (!coupon.active) return "inactive";
  if (coupon.startsAt && coupon.startsAt > now) return "scheduled";
  if (coupon.endsAt && coupon.endsAt <= now) return "expired";
  if (coupon.maxRedemptions !== null && coupon.redemptionsCount >= coupon.maxRedemptions) {
    return "exhausted";
  }
  return "active";
}

export function mapCouponToRow(
  coupon: Coupon,
  productNameById: ReadonlyMap<string, string>,
  now: string,
): CouponRow {
  const products = (coupon.productIds ?? []).map(
    (id) => productNameById.get(id) ?? `Product ${shortId(id)}`,
  );

  return {
    id: coupon.id,
    code: coupon.code,
    kind: coupon.kind,
    valueBps: coupon.kind === "percent" ? coupon.value : undefined,
    amount:
      coupon.kind === "fixed"
        ? { amountMinor: coupon.value, currency: (coupon.currency ?? "INR") as Currency }
        : undefined,
    startsAt: coupon.startsAt ? coupon.startsAt.toISOString() : now,
    endsAt: coupon.endsAt ? coupon.endsAt.toISOString() : undefined,
    used: coupon.redemptionsCount,
    max: coupon.maxRedemptions ?? undefined,
    products,
    firstPurchaseOnly: coupon.firstPurchaseOnly,
    state: couponState(coupon, new Date(now)),
    createdBy: coupon.createdBy ? `Admin ${shortId(coupon.createdBy)}` : "System",
  };
}
