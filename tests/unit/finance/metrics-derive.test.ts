import { describe, expect, it } from "vitest";
import { EMPTY_RAW_SUMS, addRawSums, deriveMetrics } from "@/modules/finance/metrics-core";

describe("deriveMetrics", () => {
  it("coupon order: gross 41000.00 - discount = net 1.00; net + tax = collected", () => {
    const m = deriveMetrics({
      ...EMPTY_RAW_SUMS,
      sale: 4_100_000,
      discount: 4_099_900,
      companyCut: 20,
      partnerAllocation: 80,
    });
    expect(m.netSalesMinor).toBe(100);
    expect(m.collectedMinor).toBe(100);
    expect(m.profitMinor).toBe(100);
  });

  it("tax, fees, refunds and expenses", () => {
    const m = deriveMetrics({
      ...EMPTY_RAW_SUMS,
      sale: 100_000,
      tax: 18_000,
      gatewayFee: 500,
      bankCharge: 100,
      refundSale: 5_000,
      refundDiscount: 0,
      refundTax: 900,
      companyCut: 16_000,
      partnerAllocation: 64_000,
      refundCompanyCut: 1_000,
      refundPartnerAllocation: 4_000,
      expense: 3_000,
    });
    expect(m.collectedMinor).toBe(118_000);
    expect(m.feesMinor).toBe(600);
    expect(m.refundsMinor).toBe(5_900);
    expect(m.companyShareMinor).toBe(15_000);
    expect(m.partnerSharesMinor).toBe(60_000);
    expect(m.profitMinor).toBe(72_000);
  });

  it("empty is all zero and addRawSums is additive", () => {
    expect(Object.values(deriveMetrics(EMPTY_RAW_SUMS)).every((v) => v === 0)).toBe(true);
    const a = { ...EMPTY_RAW_SUMS, sale: 1 };
    expect(addRawSums(a, a).sale).toBe(2);
  });
});
