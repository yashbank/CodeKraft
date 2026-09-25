import { describe, expect, it } from "vitest";
import { effectiveTaxRateBps } from "@/modules/settings/tax";

describe("effectiveTaxRateBps (PHASE-03 P3.3, MASTER_SPEC §7)", () => {
  it("returns 0 when product has taxEnabled === false, even if settings has taxRateBps and GSTIN", () => {
    const rate = effectiveTaxRateBps(
      { taxEnabled: false },
      { taxRateBps: 1800, gstin: "27AAAAA0000A1Z5" },
    );
    expect(rate).toBe(0);
  });

  it("returns 0 when GSTIN is null, even when product has taxEnabled === true and taxRateBps > 0", () => {
    const rate = effectiveTaxRateBps({ taxEnabled: true }, { taxRateBps: 1800, gstin: null });
    expect(rate).toBe(0);
  });

  it("returns 0 when GSTIN is empty string", () => {
    const rate = effectiveTaxRateBps({ taxEnabled: true }, { taxRateBps: 1800, gstin: "   " });
    expect(rate).toBe(0);
  });

  it("returns settings.taxRateBps when product is taxable and valid GSTIN is configured", () => {
    const rate = effectiveTaxRateBps(
      { taxEnabled: true },
      { taxRateBps: 1800, gstin: "27AAAAA0000A1Z5" },
    );
    expect(rate).toBe(1800);
  });

  it("works when called with settings alone (product assumed taxable)", () => {
    const withoutGstin = effectiveTaxRateBps({ taxRateBps: 1800, gstin: null });
    expect(withoutGstin).toBe(0);

    const withGstin = effectiveTaxRateBps({ taxRateBps: 1800, gstin: "27AAAAA0000A1Z5" });
    expect(withGstin).toBe(1800);
  });
});
