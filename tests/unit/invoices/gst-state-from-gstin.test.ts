// @vitest-environment node
import { describe, expect, it } from "vitest";
import { computeGstBreakdown, gstinState } from "@/modules/invoices/gst";
import { buildSellerSnapshot } from "@/modules/invoices/service";

const settings = { siteName: "C", siteLogo: null, sellerDetails: null, gstin: "27AAAAA0000A1Z5" };
const split = (sellerGstin: string, buyerGstin: string | null) =>
  computeGstBreakdown({
    sellerState: buildSellerSnapshot({ ...settings, gstin: sellerGstin }).state_code,
    buyerState: gstinState(buyerGstin),
    taxMinor: 1801,
    taxRateBps: 1800,
    gstin: sellerGstin,
  });

describe("GST split from GSTIN state codes", () => {
  it("same state: CGST + SGST sum exactly to the tax", () => {
    const r = split("27AAAAA0000A1Z5", "27BBBBB1111B1Z2");
    expect(r?.igst_minor).toBeUndefined();
    expect((r?.cgst_minor ?? 0) + (r?.sgst_minor ?? 0)).toBe(1801);
  });
  it("different state: IGST", () => {
    expect(split("27AAAAA0000A1Z5", "29BBBBB1111B1Z2")?.igst_minor).toBe(1801);
  });
  it("buyer without GSTIN: IGST", () => {
    expect(split("27AAAAA0000A1Z5", null)?.igst_minor).toBe(1801);
  });
  it("seller without GSTIN: no breakdown", () => {
    expect(
      computeGstBreakdown({
        sellerState: "KA",
        buyerState: "KA",
        taxMinor: 100,
        taxRateBps: 1800,
        gstin: null,
      }),
    ).toBeUndefined();
  });
  it("an unknown seller state never matches a buyer by default", () => {
    expect(
      computeGstBreakdown({
        buyerState: "29",
        sellerState: null,
        taxMinor: 100,
        taxRateBps: 1800,
        gstin: "x",
      })?.igst_minor,
    ).toBe(100);
  });
});
