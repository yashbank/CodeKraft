import { describe, expect, it } from "vitest";
import { computeCouponDiscount } from "@/modules/coupons/types";
import { money } from "@/lib/money";

describe("coupon discount math (docs/06 §2.3, A-401)", () => {
  it("calculates percentage discount using bps with half-up rounding", () => {
    // 10% = 1000 bps of 5000 paise = 500 paise
    const discount1 = computeCouponDiscount("percent", 1000, money(5000, "INR"));
    expect(discount1).toBe(500);

    // 15% = 1500 bps of 999 paise = 149.85 -> half-up rounds to 150 paise
    const discount2 = computeCouponDiscount("percent", 1500, money(999, "INR"));
    expect(discount2).toBe(150);

    // 100% = 10000 bps
    const discount3 = computeCouponDiscount("percent", 10000, money(3500, "INR"));
    expect(discount3).toBe(3500);
  });

  it("calculates fixed discount capped at subtotal", () => {
    // Flat 500 off on 2000 -> 500
    const discount1 = computeCouponDiscount("fixed", 500, money(2000, "INR"));
    expect(discount1).toBe(500);

    // Flat 500 off on 300 -> capped at 300
    const discount2 = computeCouponDiscount("fixed", 500, money(300, "INR"));
    expect(discount2).toBe(300);

    // Flat equal to subtotal
    const discount3 = computeCouponDiscount("fixed", 1000, money(1000, "INR"));
    expect(discount3).toBe(1000);
  });
});
