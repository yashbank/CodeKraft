import { describe, expect, it } from "vitest";
import { buildItemPostingPlan } from "@/modules/finance/posting";
import { inr } from "@/components/admin/format";

const base = {
  orderId: "00000000-0000-4000-8000-000000000010",
  orderItemId: "00000000-0000-4000-8000-000000000011",
  paymentId: "00000000-0000-4000-8000-000000000012",
  currency: "INR" as const,
  grossMinor: 100,
  discountMinor: 0,
  taxMinor: 0,
  gatewayFeeMinor: 0,
  bankShortfallMinor: 0,
  companyCutBps: 10000,
  lines: [] as { partnerId: string; shareBps: number }[],
  ownershipId: null,
  fxRateToInr: "1.00000000",
  createdBy: "00000000-0000-4000-8000-000000000009",
  createdAt: new Date("2026-10-01T10:00:00Z"),
};

describe("Rs 1 (100 paise) order posting and display", () => {
  it("no tax: sale -100, company +100, nothing inflated", () => {
    const { entries } = buildItemPostingPlan(base);
    const by = Object.fromEntries(entries.map((e) => [e.entryType, e.amountInrMinor]));
    expect(by).toEqual({ sale: -100, company_cut: 100 });
    const credits = entries
      .filter((e) => e.amountInrMinor > 0)
      .reduce((s, e) => s + e.amountInrMinor, 0);
    expect(inr(credits)).toBe("₹1.00");
  });

  it("18% tax: tax entry is 18 paise, nothing is 10x inflated", () => {
    const { entries } = buildItemPostingPlan({ ...base, taxMinor: 18 });
    const by = Object.fromEntries(entries.map((e) => [e.entryType, e.amountInrMinor]));
    expect(by.sale).toBe(-100);
    expect(by.tax_collected).toBe(18);
    expect(entries.every((e) => Math.abs(e.amountInrMinor) <= 100)).toBe(true);
    expect(inr(18)).toBe("₹0.18");
  });
});
