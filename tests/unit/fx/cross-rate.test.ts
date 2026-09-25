import { describe, expect, it } from "vitest";
import { computeCrossRate } from "@/modules/fx/client";

describe("FX Cross-Rate Resolution (PHASE-03 P3.12, D-502)", () => {
  it("computes cross-rate via base INR accurately using pure bigint arithmetic", () => {
    // 1 USD = 83.50000000 INR
    // 1 INR = 0.01100000 EUR
    // 1 USD = 83.5 * 0.011 = 0.91850000 EUR
    const usdToInr = "83.50000000";
    const inrToEur = "0.01100000";
    const cross = computeCrossRate(usdToInr, inrToEur);
    expect(cross).toBe("0.91850000");
  });

  it("handles symmetrical cross-rates", () => {
    // 1 EUR = 90.90000000 INR
    // 1 INR = 0.01200000 USD
    // 1 EUR = 90.9 * 0.012 = 1.09080000 USD
    const eurToInr = "90.90000000";
    const inrToUsd = "0.01200000";
    const cross = computeCrossRate(eurToInr, inrToUsd);
    expect(cross).toBe("1.09080000");
  });
});
