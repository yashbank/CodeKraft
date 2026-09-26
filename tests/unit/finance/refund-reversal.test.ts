import { describe, expect, it } from "vitest";
import { computeItemRefundPlan } from "@/modules/finance/refunds";

describe("computeItemRefundPlan (unit)", () => {
  const baseInput = {
    orderId: "11111111-1111-4111-8111-111111111111",
    orderItemId: "22222222-2222-4222-8222-222222222222",
    paymentId: "33333333-3333-4333-8333-333333333333",
    refundId: "44444444-4444-4444-8444-444444444444",
    currency: "INR" as const,
    fxRateToInr: "1.00000000",
    createdBy: "55555555-5555-4555-8555-555555555555",
    createdAt: new Date("2026-09-01T12:00:00Z"),
  };

  it("produces exact reverse entries on full refund", () => {
    // Gross: 10,000, discount: 1,000, tax: 1,620 -> total = 10620
    // Distributable = 10000 - 1000 - 1620 = 7380. Company = 2214, Partners = 2583 + 2583
    const entries = computeItemRefundPlan({
      ...baseInput,
      grossMinor: 10_000,
      discountMinor: 1_000,
      taxMinor: 1_620,
      companyMinor: 2_214,
      partnerLines: [
        { partnerId: "p1", amountMinor: 2_583 },
        { partnerId: "p2", amountMinor: 2_583 },
      ],
      itemRefundAmountMinor: 10_620,
      itemTotalMinor: 10_620,
    });

    // Check entry types and amounts
    const sale = entries.find((e) => e.entryType === "refund_sale");
    const discount = entries.find((e) => e.entryType === "refund_discount");
    const tax = entries.find((e) => e.entryType === "refund_tax");
    const company = entries.find((e) => e.entryType === "refund_company_cut");
    const partners = entries.filter((e) => e.entryType === "refund_partner_allocation");

    expect(sale?.amountMinor).toBe(10_000);
    expect(discount?.amountMinor).toBe(-1_000);
    expect(tax?.amountMinor).toBe(-1_620);
    expect(company?.amountMinor).toBe(-2_214);
    expect(partners).toHaveLength(2);
    expect(partners[0]?.amountMinor).toBe(-2_583);
    expect(partners[1]?.amountMinor).toBe(-2_583);

    // Sum across all parties is exactly 0 (FI-04)
    const total = entries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(total).toBe(0);
  });

  it("computes balanced proportional entries on partial refund (largest remainder)", () => {
    // Item total: 10,620. Half refund: 5,310
    const entries = computeItemRefundPlan({
      ...baseInput,
      grossMinor: 10_000,
      discountMinor: 1_000,
      taxMinor: 1_620,
      companyMinor: 2_214,
      partnerLines: [
        { partnerId: "p1", amountMinor: 2_583 },
        { partnerId: "p2", amountMinor: 2_583 },
      ],
      itemRefundAmountMinor: 5_310,
      itemTotalMinor: 10_620,
    });

    const sum = entries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(sum).toBe(0);

    const sale = entries.find((e) => e.entryType === "refund_sale");
    const discount = entries.find((e) => e.entryType === "refund_discount");
    const tax = entries.find((e) => e.entryType === "refund_tax");
    const company = entries.find((e) => e.entryType === "refund_company_cut");
    const pAlloc = entries.filter((e) => e.entryType === "refund_partner_allocation");

    expect(discount?.amountMinor).toBe(-500); // 50% of 1000
    expect(tax?.amountMinor).toBe(-810); // 50% of 1620
    // Customer net refund = refundGross - discount - tax = 5310
    // refundGross = 5310 + 500 - 810 = 5000
    expect(sale?.amountMinor).toBe(5_000);

    const partnerTotal = pAlloc.reduce((acc, p) => acc + Math.abs(p.amountMinor), 0);
    expect(Math.abs(company?.amountMinor ?? 0) + partnerTotal).toBe(
      (sale?.amountMinor ?? 0) - Math.abs(discount?.amountMinor ?? 0) - Math.abs(tax?.amountMinor ?? 0),
    );
  });

  it("handles odd split with largest remainder balancing", () => {
    // 3 partners with 1/3 each
    const entries = computeItemRefundPlan({
      ...baseInput,
      grossMinor: 10_000,
      discountMinor: 0,
      taxMinor: 0,
      companyMinor: 1_000,
      partnerLines: [
        { partnerId: "p1", amountMinor: 3_000 },
        { partnerId: "p2", amountMinor: 3_000 },
        { partnerId: "p3", amountMinor: 3_000 },
      ],
      itemRefundAmountMinor: 3_333,
      itemTotalMinor: 10_000,
    });

    const sum = entries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(sum).toBe(0);
  });

  it("returns empty entries if refund amount is 0", () => {
    const entries = computeItemRefundPlan({
      ...baseInput,
      grossMinor: 10_000,
      discountMinor: 0,
      taxMinor: 0,
      companyMinor: 1_000,
      partnerLines: [{ partnerId: "p1", amountMinor: 9_000 }],
      itemRefundAmountMinor: 0,
      itemTotalMinor: 10_000,
    });

    expect(entries).toEqual([]);
  });
});
