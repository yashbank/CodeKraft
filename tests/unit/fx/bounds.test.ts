import { describe, expect, it } from "vitest";
import { isWithinBounds } from "@/modules/fx/client";

describe("FX Sanity Bounds (TM-13, PHASE-03 P3.12)", () => {
  it("accepts rates within ±20% of previous day rate", () => {
    const prev = "100.00000000";
    expect(isWithinBounds(prev, "100.00000000")).toBe(true);
    expect(isWithinBounds(prev, "110.00000000")).toBe(true); // +10%
    expect(isWithinBounds(prev, "90.00000000")).toBe(true); // -10%
    expect(isWithinBounds(prev, "120.00000000")).toBe(true); // exactly +20%
    expect(isWithinBounds(prev, "80.00000000")).toBe(true); // exactly -20%
  });

  it("rejects poisoned rates outside ±20% boundary (TM-13)", () => {
    const prev = "100.00000000";
    expect(isWithinBounds(prev, "120.00000001")).toBe(false); // +20.000001%
    expect(isWithinBounds(prev, "125.00000000")).toBe(false); // +25%
    expect(isWithinBounds(prev, "200.00000000")).toBe(false); // 2x poisoned
    expect(isWithinBounds(prev, "79.99999999")).toBe(false); // -20.000001%
    expect(isWithinBounds(prev, "50.00000000")).toBe(false); // -50% poisoned
    expect(isWithinBounds(prev, "0.00000001")).toBe(false); // collapse
  });

  it("works with real small currency rates (INR to USD ~0.012)", () => {
    const inrToUsd = "0.01200000";
    // 0.012 * 1.20 = 0.01440000
    // 0.012 * 0.80 = 0.00960000
    expect(isWithinBounds(inrToUsd, "0.01250000")).toBe(true);
    expect(isWithinBounds(inrToUsd, "0.01440000")).toBe(true);
    expect(isWithinBounds(inrToUsd, "0.00960000")).toBe(true);
    expect(isWithinBounds(inrToUsd, "0.01440001")).toBe(false); // poisoned high
    expect(isWithinBounds(inrToUsd, "0.00959999")).toBe(false); // poisoned low
  });
});
