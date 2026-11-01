// C16-01: Rs 1001 must never display as $1001 (rate 1 rejected, explicit copies flagged).
import { describe, expect, it } from "vitest";
import {
  convertWithTable,
  hasAllRates,
  isUsableInrRate,
  mismatchedPriceRows,
  type RateTable,
} from "@/lib/currency-convert";
import { buildRateTable, staticRateTable } from "@/modules/fx/convert";
import { setFxOverrideSchema } from "@/modules/fx/contracts";

const live: RateTable = {
  base: "INR",
  rates: { INR: "1", USD: "0.01190000", EUR: "0.01100000", GBP: "0.00920000", CAD: "0.01650000" },
  fetchedAt: new Date().toISOString(),
  stale: false,
  source: "test",
};

const row = (quote: string, rate: string) => ({
  base: "INR",
  quote,
  rate,
  asOf: "2026-11-02",
  source: "manual",
  createdAt: new Date(),
});

describe("C16-01 rate of 1 is never valid between INR and another currency", () => {
  it("isUsableInrRate", () => {
    expect(isUsableInrRate("USD", "1")).toBe(false);
    expect(isUsableInrRate("USD", "1.00000000")).toBe(false);
    expect(isUsableInrRate("USD", "0")).toBe(false);
    expect(isUsableInrRate("USD", "-0.01")).toBe(false);
    expect(isUsableInrRate("USD", "0.0119")).toBe(true);
    expect(isUsableInrRate("INR", "1")).toBe(true);
  });

  it("hasAllRates rejects a table with USD = 1", () => {
    expect(hasAllRates({ ...live, rates: { ...live.rates, USD: "1" } })).toBe(false);
    expect(hasAllRates(live)).toBe(true);
  });

  it("buildRateTable skips a newer rate-1 row and keeps the older real one", () => {
    const old = { ...row("USD", "0.01190000"), asOf: "2026-11-01" };
    const t = buildRateTable([row("USD", "1"), old]);
    expect(t.rates.USD).toBe("0.01190000");
  });

  it("static table has a real rate for every currency", () => {
    expect(hasAllRates(staticRateTable())).toBe(true);
  });

  it("manual override of 1 is rejected", () => {
    expect(
      setFxOverrideSchema.safeParse({ quote: "USD", rate: "1", asOf: "2026-11-02" }).success,
    ).toBe(false);
    expect(
      setFxOverrideSchema.safeParse({ quote: "USD", rate: "0.0119", asOf: "2026-11-02" }).success,
    ).toBe(true);
  });

  it("Rs 800 shows about $9-10 at the live rate", () => {
    const usd = convertWithTable(80_000, "INR", "USD", live);
    expect(usd).toBeGreaterThanOrEqual(900);
    expect(usd).toBeLessThanOrEqual(1000);
  });
});

describe("C16-01 mismatchedPriceRows flags an INR amount typed into another currency", () => {
  it("flags USD 1001 next to INR 1001, not a sane USD row", () => {
    const bad = mismatchedPriceRows(
      [
        { currency: "INR", amountMinor: 100_100 },
        { currency: "USD", amountMinor: 100_100 },
        { currency: "EUR", amountMinor: 1_100 },
      ],
      live,
    );
    expect(bad.map((b) => b.currency)).toEqual(["USD"]);
    expect(bad[0]?.expectedMinor).toBe(1_191);
  });

  it("no INR row or no usable table -> nothing flagged", () => {
    expect(mismatchedPriceRows([{ currency: "USD", amountMinor: 100 }], live)).toEqual([]);
    expect(
      mismatchedPriceRows(
        [
          { currency: "INR", amountMinor: 100 },
          { currency: "USD", amountMinor: 100 },
        ],
        { ...live, rates: { ...live.rates, USD: "1" } },
      ),
    ).toEqual([]);
  });
});
