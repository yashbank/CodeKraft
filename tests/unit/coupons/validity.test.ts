import { describe, expect, it } from "vitest";
import { upsertCouponInput } from "@/modules/coupons/types";

describe("coupon schema validations (API-COM-08, A-401)", () => {
  it("accepts valid percent coupon", () => {
    const valid = upsertCouponInput.safeParse({
      code: "SAVE20NOW",
      kind: "percent",
      value: 2000, // 20%
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2026-12-31T23:59:59Z",
      maxRedemptions: 100,
    });
    expect(valid.success).toBe(true);
  });

  it("accepts valid fixed coupon", () => {
    const valid = upsertCouponInput.safeParse({
      code: "FLAT500OFF",
      kind: "fixed",
      value: 50000, // 500 INR in paise
      currency: "INR",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects percent coupon with currency", () => {
    const res = upsertCouponInput.safeParse({
      code: "DISCOUNT10",
      kind: "percent",
      value: 1000,
      currency: "INR",
    });
    expect(res.success).toBe(false);
  });

  it("rejects fixed coupon without currency", () => {
    const res = upsertCouponInput.safeParse({
      code: "DISCOUNT10",
      kind: "fixed",
      value: 1000,
    });
    expect(res.success).toBe(false);
  });

  it("rejects percent coupon with value > 10000 bps", () => {
    const res = upsertCouponInput.safeParse({
      code: "HUGE150PCT",
      kind: "percent",
      value: 15000,
    });
    expect(res.success).toBe(false);
  });

  it("rejects coupon with endsAt <= startsAt", () => {
    const res = upsertCouponInput.safeParse({
      code: "TIMEWARP20",
      kind: "percent",
      value: 2000,
      startsAt: "2026-06-01T00:00:00Z",
      endsAt: "2026-05-01T00:00:00Z",
    });
    expect(res.success).toBe(false);
  });
});
