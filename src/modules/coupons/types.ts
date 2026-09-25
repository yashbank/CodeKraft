/**
 * Coupons — Zod input schemas and output types (docs/06 §2.3 API-COM-08; validation rules of
 * API-COM-01/02; A-401). `value` is bps for `percent` and minor units for `fixed`.
 */
import { z } from "zod";
import { type Money, mulBps } from "@/lib/money";
import type { Coupon } from "../../../drizzle/schema/commerce";
import {
  bpsSchema as zBps,
  currencySchema as zCurrency,
  isoDateTimeSchema as zIsoTimestamp,
  listParams as zListParams,
  moneySchema as zMoney,
  positiveMinorUnitsSchema as zPositiveMinor,
  uuidSchema as zUuid,
} from "@/modules/_shared/zod";
import { zCouponCode } from "@/modules/orders/types";

export const COUPON_KINDS = ["percent", "fixed"] as const;
export type CouponKind = (typeof COUPON_KINDS)[number];

// ---------------------------------------------------------------------------------------------
// API-COM-08 upsertCoupon / deactivateCoupon / listCoupons — `orders.manual.write`
// ---------------------------------------------------------------------------------------------

export const upsertCouponInput = z
  .object({
    id: zUuid.optional(),
    code: zCouponCode,
    kind: z.enum(COUPON_KINDS),
    /** bps (1..10000) for `percent`, minor units (> 0) for `fixed`. */
    value: z.number().int().positive(),
    /** Required for `fixed`, forbidden for `percent`. */
    currency: zCurrency.optional(),
    startsAt: zIsoTimestamp.optional(),
    endsAt: zIsoTimestamp.optional(),
    maxRedemptions: z.number().int().positive().optional(),
    firstPurchaseOnly: z.boolean().default(false),
    productIds: z.array(zUuid).max(100).optional(),
    active: z.boolean().default(true),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.kind === "percent") {
      if (c.value > 10_000) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "percent value is bps ≤ 10000" });
      }
      if (c.currency !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["currency"],
          message: "percent coupons have no currency",
        });
      }
    } else if (c.currency === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["currency"],
        message: "fixed coupons need a currency",
      });
    }
    if (c.startsAt !== undefined && c.endsAt !== undefined && c.endsAt <= c.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "endsAt must be after startsAt" });
    }
  });
export type UpsertCouponInput = z.infer<typeof upsertCouponInput>;

export const deactivateCouponInput = z.object({ id: zUuid }).strict();
export type DeactivateCouponInput = z.infer<typeof deactivateCouponInput>;

export const listCouponsInput = zListParams(
  ["createdAt", "code", "endsAt"],
  z.object({ active: z.boolean().optional(), kind: z.enum(COUPON_KINDS).optional() }).strict(),
);
export type ListCouponsInput = z.infer<typeof listCouponsInput>;

// ---------------------------------------------------------------------------------------------
// validateForOrder — the coupon checks behind API-COM-01/02 `VALIDATION` failures
// ---------------------------------------------------------------------------------------------

export const COUPON_REJECT_REASONS = [
  "not_found",
  "inactive",
  "not_started",
  "expired",
  "exhausted",
  "first_purchase_only",
  "product_restricted",
  "currency_mismatch",
  "not_applicable", // custom-quote orders take no coupons (API-COM-10)
] as const;
export type CouponRejectReason = (typeof COUPON_REJECT_REASONS)[number];

export const validateCouponInput = z
  .object({
    code: zCouponCode,
    /** Null for anonymous previews; first-purchase checks need the user. */
    userId: zUuid.nullable(),
    productId: zUuid,
    /** Discounted base: the order subtotal in base currency. */
    subtotal: zMoney,
    at: zIsoTimestamp.optional(),
  })
  .strict();
export type ValidateCouponInput = z.infer<typeof validateCouponInput>;

export type CouponValidation =
  | { valid: true; coupon: Pick<Coupon, "id" | "code" | "kind" | "value">; discountMinor: number }
  | { valid: false; reason: CouponRejectReason };

/** `percent` → `subtotal × bps / 10000` (half-up); `fixed` → `min(value, subtotal)`. Never negative. */
export function computeCouponDiscount(kind: CouponKind, value: number, subtotal: Money): number {
  zBps.parse(kind === "percent" ? value : 0);
  zPositiveMinor.parse(value);
  if (kind === "percent") return mulBps(subtotal, value).amountMinor;
  return value < subtotal.amountMinor ? value : subtotal.amountMinor;
}

export type { Coupon };
