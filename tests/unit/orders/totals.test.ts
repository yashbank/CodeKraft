import { describe, expect, it } from "vitest";
import { calculateItemPricing, calculateOrderTotals } from "@/modules/orders/totals";

describe("orders totals & tax math (FI-12, docs/06 §1.9)", () => {
  it("calculates simple item pricing with zero discount and zero tax", () => {
    const res = calculateItemPricing({
      unitMinor: 1000,
      quantity: 2,
      discountMinor: 0,
      taxRateBps: 0,
    });

    expect(res).toEqual({
      unitMinor: 1000,
      quantity: 2,
      grossMinor: 2000,
      discountMinor: 0,
      taxableMinor: 2000,
      taxMinor: 0,
      totalMinor: 2000,
    });
  });

  it("calculates item pricing with discount and standard 18% GST (1800 bps)", () => {
    // 5000 unit * 1 qty = 5000 gross. Discount 1000 -> 4000 taxable.
    // 18% of 4000 = 720 tax -> 4720 total.
    const res = calculateItemPricing({
      unitMinor: 5000,
      quantity: 1,
      discountMinor: 1000,
      taxRateBps: 1800,
    });

    expect(res).toEqual({
      unitMinor: 5000,
      quantity: 1,
      grossMinor: 5000,
      discountMinor: 1000,
      taxableMinor: 4000,
      taxMinor: 720,
      totalMinor: 4720,
    });
  });

  it("applies FI-12 round-half-up tax rounding accurately", () => {
    // Taxable = 999 minor. Tax 18% = 179.82 -> half-up rounds to 180.
    const res1 = calculateItemPricing({
      unitMinor: 999,
      quantity: 1,
      discountMinor: 0,
      taxRateBps: 1800,
    });
    expect(res1.taxMinor).toBe(180);
    expect(res1.totalMinor).toBe(1179);

    // Exact half case: (taxable * bps + 5000) / 10000.
    // Taxable = 250, 18% = 45 -> 45 minor.
    // Let taxable = 25, 18% = 4.5 -> rounds to 5.
    const res2 = calculateItemPricing({
      unitMinor: 25,
      quantity: 1,
      discountMinor: 0,
      taxRateBps: 1800,
    });
    expect(res2.taxMinor).toBe(5);
    expect(res2.totalMinor).toBe(30);
  });

  it("caps discount at subtotal", () => {
    const res = calculateItemPricing({
      unitMinor: 1000,
      quantity: 1,
      discountMinor: 1500,
      taxRateBps: 1800,
    });
    expect(res.discountMinor).toBe(1000);
    expect(res.taxableMinor).toBe(0);
    expect(res.taxMinor).toBe(0);
    expect(res.totalMinor).toBe(0);
  });

  it("aggregates multiple item lines into order totals", () => {
    const line1 = calculateItemPricing({
      unitMinor: 2000,
      quantity: 1,
      discountMinor: 0,
      taxRateBps: 1800, // 360 tax -> 2360 total
    });
    const line2 = calculateItemPricing({
      unitMinor: 1000,
      quantity: 2,
      discountMinor: 500,
      taxRateBps: 1800, // 1500 taxable * 18% = 270 tax -> 1770 total
    });

    const orderTotals = calculateOrderTotals([line1, line2]);
    expect(orderTotals).toEqual({
      subtotalMinor: 4000,
      discountMinor: 500,
      taxMinor: 630,
      totalMinor: 4130,
    });
  });
});
