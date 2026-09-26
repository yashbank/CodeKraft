import { describe, expect, it } from "vitest";
import { computeGstBreakdown } from "@/modules/invoices/gst";

describe("No GST without GSTIN (D-1501, BR-08)", () => {
  it("returns undefined when gstin is null or empty string", () => {
    expect(
      computeGstBreakdown({
        buyerState: "KA",
        sellerState: "KA",
        taxMinor: 1800,
        taxRateBps: 1800,
        gstin: null,
      })
    ).toBeUndefined();

    expect(
      computeGstBreakdown({
        buyerState: "MH",
        sellerState: "KA",
        taxMinor: 1800,
        taxRateBps: 1800,
        gstin: "",
      })
    ).toBeUndefined();

    expect(
      computeGstBreakdown({
        buyerState: "KA",
        sellerState: "KA",
        taxMinor: 1800,
        taxRateBps: 1800,
        gstin: "   ",
      })
    ).toBeUndefined();
  });
});
