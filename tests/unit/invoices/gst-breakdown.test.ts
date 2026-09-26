import { describe, expect, it } from "vitest";
import { computeGstBreakdown } from "@/modules/invoices/gst";

describe("GST breakdown unit tests (D-1501, BR-08)", () => {
  it("splits equally into CGST and SGST when buyer state matches seller state", () => {
    const res = computeGstBreakdown({
      buyerState: "KA",
      sellerState: "KA",
      taxMinor: 1800,
      taxRateBps: 1800,
      gstin: "29AAAAA0000A1Z5",
    });

    expect(res).toBeDefined();
    expect(res!.cgst_minor).toBe(900);
    expect(res!.sgst_minor).toBe(900);
    expect(res!.igst_minor).toBeUndefined();
    expect(res!.rate_bps).toBe(1800);
  });

  it("handles odd minor units without losing paise between CGST and SGST", () => {
    const res = computeGstBreakdown({
      buyerState: "29",
      sellerState: "29",
      taxMinor: 1801,
      taxRateBps: 1800,
      gstin: "29AAAAA0000A1Z5",
    });

    expect(res).toBeDefined();
    expect(res!.cgst_minor! + res!.sgst_minor!).toBe(1801);
  });

  it("allocates entire tax to IGST for inter-state buyer", () => {
    const res = computeGstBreakdown({
      buyerState: "MH",
      sellerState: "KA",
      taxMinor: 1800,
      taxRateBps: 1800,
      gstin: "29AAAAA0000A1Z5",
    });

    expect(res).toBeDefined();
    expect(res!.cgst_minor).toBeUndefined();
    expect(res!.sgst_minor).toBeUndefined();
    expect(res!.igst_minor).toBe(1800);
  });
});
