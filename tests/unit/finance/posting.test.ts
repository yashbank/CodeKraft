import { describe, expect, it } from "vitest";
import { buildItemPostingPlan } from "@/modules/finance/posting";

describe("posting plan builder (docs/06 §4.2, FI-01, FI-02, FI-04, FI-11)", () => {
  const baseInput = {
    orderId: "00000000-0000-4000-8000-000000000010",
    orderItemId: "00000000-0000-4000-8000-000000000011",
    paymentId: "00000000-0000-4000-8000-000000000012",
    currency: "INR" as const,
    grossMinor: 10000,
    discountMinor: 1000,
    taxMinor: 1620,
    gatewayFeeMinor: 0,
    bankShortfallMinor: 200,
    companyCutBps: 2000,
    lines: [
      { partnerId: "00000000-0000-4000-8000-000000000001", shareBps: 6000 },
      { partnerId: "00000000-0000-4000-8000-000000000002", shareBps: 4000 },
    ],
    ownershipId: "00000000-0000-4000-8000-000000000003",
    fxRateToInr: "1.00000000",
    createdBy: "00000000-0000-4000-8000-000000000009",
    createdAt: new Date("2026-09-25T10:00:00Z"),
  };

  it("builds the full set of entries with correct party types and sign conventions", () => {
    const plan = buildItemPostingPlan(baseInput);

    // gross = 10000, discount = 1000, tax = 1620, fee = 0, shortfall = 200
    // distributable = 10000 - 1000 - 1620 - 0 - 200 = 7180
    // company (20%) = 1436
    // partner pool = 7180 - 1436 = 5744
    // p1 (60%): 3446.4 -> 3446
    // p2 (40%): 2297.6 -> 2298
    // sum = 3446 + 2298 = 5744
    expect(plan.allocation.distributableMinor).toBe(7180);
    expect(plan.allocation.companyMinor).toBe(1436);
    expect(plan.allocation.lines).toEqual([
      { partner_id: "00000000-0000-4000-8000-000000000001", share_bps: 6000, amount_minor: 3446 },
      { partner_id: "00000000-0000-4000-8000-000000000002", share_bps: 4000, amount_minor: 2298 },
    ]);

    // Check entry set
    const entries = plan.entries;
    expect(entries.map((e) => e.entryType)).toEqual([
      "sale",
      "discount",
      "tax_collected",
      "bank_charge",
      "company_cut",
      "partner_allocation",
      "partner_allocation",
    ]);

    // Check party types
    const sale = entries.find((e) => e.entryType === "sale")!;
    expect(sale.partyType).toBe("customer");
    expect(sale.amountMinor).toBe(-10000);

    const discount = entries.find((e) => e.entryType === "discount")!;
    expect(discount.partyType).toBe("customer");
    expect(discount.amountMinor).toBe(1000);

    const tax = entries.find((e) => e.entryType === "tax_collected")!;
    expect(tax.partyType).toBe("tax_authority");
    expect(tax.amountMinor).toBe(1620);

    const bank = entries.find((e) => e.entryType === "bank_charge")!;
    expect(bank.partyType).toBe("bank");
    expect(bank.amountMinor).toBe(200);

    const company = entries.find((e) => e.entryType === "company_cut")!;
    expect(company.partyType).toBe("company");
    expect(company.amountMinor).toBe(1436);

    const pLines = entries.filter((e) => e.entryType === "partner_allocation");
    expect(pLines).toHaveLength(2);
    expect(pLines[0]?.partyType).toBe("partner");
    expect(pLines[0]?.partnerId).toBe("00000000-0000-4000-8000-000000000001");
    expect(pLines[0]?.amountMinor).toBe(3446);

    expect(pLines[1]?.partyType).toBe("partner");
    expect(pLines[1]?.partnerId).toBe("00000000-0000-4000-8000-000000000002");
    expect(pLines[1]?.amountMinor).toBe(2298);

    // FI-04: Sum of all entries per order/item must equal 0
    const sum = entries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(sum).toBe(0);

    // Sum in INR must also equal 0
    const sumInr = entries.reduce((acc, e) => acc + e.amountInrMinor, 0);
    expect(sumInr).toBe(0);
  });

  it("omits discount and bank shortfall entries when they are 0, preserving FI-04", () => {
    const plan = buildItemPostingPlan({
      ...baseInput,
      discountMinor: 0,
      bankShortfallMinor: 0,
      gatewayFeeMinor: 0,
      taxMinor: 0,
    });

    // distributable = 10000
    // company (20%) = 2000
    // partner pool = 8000 -> 4800, 3200
    expect(plan.entries.map((e) => e.entryType)).toEqual([
      "sale",
      "company_cut",
      "partner_allocation",
      "partner_allocation",
    ]);

    const sum = plan.entries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(sum).toBe(0);
  });

  it("includes company_cut even when company cut is 0 bps per spec", () => {
    const plan = buildItemPostingPlan({
      ...baseInput,
      companyCutBps: 0,
      discountMinor: 0,
      bankShortfallMinor: 0,
      taxMinor: 0,
    });

    const company = plan.entries.find((e) => e.entryType === "company_cut");
    expect(company).toBeDefined();
    expect(company?.amountMinor).toBe(0);

    const sum = plan.entries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(sum).toBe(0);
  });

  it("converts amounts to INR using fxRateToInr for non-INR currencies", () => {
    const plan = buildItemPostingPlan({
      ...baseInput,
      currency: "USD",
      fxRateToInr: "84.50000000",
      grossMinor: 1000, // $10.00
      discountMinor: 0,
      taxMinor: 0,
      gatewayFeeMinor: 0,
      bankShortfallMinor: 0,
      companyCutBps: 0,
      lines: [{ partnerId: "00000000-0000-4000-8000-000000000001", shareBps: 10000 }],
    });

    const sale = plan.entries.find((e) => e.entryType === "sale")!;
    expect(sale.amountMinor).toBe(-1000);
    expect(sale.amountInrMinor).toBe(-84500);

    const partner = plan.entries.find((e) => e.entryType === "partner_allocation")!;
    expect(partner.amountMinor).toBe(1000);
    expect(partner.amountInrMinor).toBe(84500);

    const sum = plan.entries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(sum).toBe(0);
    const sumInr = plan.entries.reduce((acc, e) => acc + e.amountInrMinor, 0);
    expect(sumInr).toBe(0);
  });
});
