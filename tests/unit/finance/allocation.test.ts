import { describe, expect, it } from "vitest";
import { computeAllocation, spreadDeduction } from "@/modules/finance/allocation";

describe("allocation math (docs/06 §4.2, BR-06, BR-07, FI-01, FI-02)", () => {
  it("60/40 with 10 % company cut", () => {
    // Gross 10,000, no deductions, 10% company cut (1000 bps)
    // distributable = 10,000
    // company = 1,000
    // partner pool = 9,000
    // partner 1 (60% = 6000 bps) -> 5,400
    // partner 2 (40% = 4000 bps) -> 3,600
    const res = computeAllocation({
      currency: "INR",
      grossMinor: 10000,
      discountMinor: 0,
      taxMinor: 0,
      gatewayFeeMinor: 0,
      bankShortfallMinor: 0,
      companyCutBps: 1000,
      lines: [
        { partnerId: "00000000-0000-4000-8000-000000000001", shareBps: 6000 },
        { partnerId: "00000000-0000-4000-8000-000000000002", shareBps: 4000 },
      ],
    });

    expect(res.distributableMinor).toBe(10000);
    expect(res.companyMinor).toBe(1000);
    expect(res.lines).toHaveLength(2);
    expect(res.lines[0]?.amount_minor).toBe(5400);
    expect(res.lines[1]?.amount_minor).toBe(3600);
    expect(res.companyMinor + res.lines[0]!.amount_minor + res.lines[1]!.amount_minor).toBe(10000);
  });

  it("100 % single partner with zero company cut", () => {
    const res = computeAllocation({
      currency: "INR",
      grossMinor: 50000,
      discountMinor: 5000,
      taxMinor: 0,
      gatewayFeeMinor: 0,
      bankShortfallMinor: 0,
      companyCutBps: 0,
      lines: [
        { partnerId: "00000000-0000-4000-8000-000000000001", shareBps: 10000 },
      ],
    });

    expect(res.distributableMinor).toBe(45000);
    expect(res.companyMinor).toBe(0);
    expect(res.lines).toHaveLength(1);
    expect(res.lines[0]?.amount_minor).toBe(45000);
  });

  it("3-way 3333/3333/3334 with remainder assigned to the largest share", () => {
    // Gross 100 minor units, 0 company cut
    // distributable = 100
    // Ideal:
    // P1 (3333 bps): 33.33 -> 33
    // P2 (3333 bps): 33.33 -> 33
    // P3 (3334 bps): 33.34 -> 33
    // Sum = 99, remainder = 1
    // Largest fraction is P3 (.34 vs .33) -> P3 gets remainder -> 34!
    const res = computeAllocation({
      currency: "INR",
      grossMinor: 100,
      discountMinor: 0,
      taxMinor: 0,
      gatewayFeeMinor: 0,
      bankShortfallMinor: 0,
      companyCutBps: 0,
      lines: [
        { partnerId: "00000000-0000-4000-8000-000000000001", shareBps: 3333 },
        { partnerId: "00000000-0000-4000-8000-000000000002", shareBps: 3333 },
        { partnerId: "00000000-0000-4000-8000-000000000003", shareBps: 3334 },
      ],
    });

    expect(res.distributableMinor).toBe(100);
    expect(res.lines[0]?.amount_minor).toBe(33);
    expect(res.lines[1]?.amount_minor).toBe(33);
    expect(res.lines[2]?.amount_minor).toBe(34);
    expect(res.lines[0]!.amount_minor + res.lines[1]!.amount_minor + res.lines[2]!.amount_minor).toBe(100);
  });

  it("spreadDeduction distributes order shortfall pro-rata by item total", () => {
    // Two items: 3,000 and 7,000 total. Shortfall = 100.
    // 30% of 100 = 30, 70% of 100 = 70.
    const spread = spreadDeduction(100, [3000, 7000]);
    expect(spread).toEqual([30, 70]);
    expect(spread.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("spreadDeduction assigns remainder to the largest item total", () => {
    // 3 items with totals 100, 200, 300 (sum 600). Deduction = 10
    // Ideal: 100/600 * 10 = 1.666 -> 1
    //        200/600 * 10 = 3.333 -> 3
    //        300/600 * 10 = 5.000 -> 5
    // Sum = 9, remainder 1 to item 1 (fraction .666 is largest!)
    const spread = spreadDeduction(10, [100, 200, 300]);
    expect(spread).toEqual([2, 3, 5]);
    expect(spread.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("spreadDeduction handles all zero items deterministically", () => {
    const spread = spreadDeduction(50, [0, 0, 0]);
    expect(spread).toEqual([50, 0, 0]);
  });
});
