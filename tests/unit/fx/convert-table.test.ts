import { describe, expect, it } from "vitest";
import { convertWithTable, hasAllRates, type RateTable } from "@/lib/currency-convert";
import { buildRateTable, staticRateTable } from "@/modules/fx/convert";

/** Units per 1 INR: 1 USD = 83 INR, 1 EUR = 90 INR, 1 GBP = 100 INR, 1 CAD = 62.5 INR. */
const T: RateTable = {
  base: "INR",
  rates: { INR: "1", USD: "0.01204819", EUR: "0.01111111", GBP: "0.01", CAD: "0.016" },
  fetchedAt: "2026-11-01T00:00:00.000Z",
  stale: false,
  source: "test",
};

describe("convertWithTable", () => {
  it("1 USD = 83 INR: 100.00 USD -> 8300.00 INR (direction + magnitude)", () => {
    expect(convertWithTable(10000, "USD", "INR", T)).toBe(830000);
  });
  it("INR -> USD", () => {
    expect(convertWithTable(830000, "INR", "USD", T)).toBe(10000);
  });
  it("same currency is identity", () => {
    expect(convertWithTable(12345, "EUR", "EUR", T)).toBe(12345);
  });
  it("negative amounts round half away from zero, symmetric with positive", () => {
    const pos = convertWithTable(1234, "USD", "EUR", T);
    expect(convertWithTable(-1234, "USD", "EUR", T)).toBe(-pos);
  });
  it("zero stays zero", () => {
    expect(convertWithTable(0, "USD", "GBP", T)).toBe(0);
  });
  it("round trip stays within a few minor units", () => {
    for (const amt of [100, 9999, 123456, 5_000_000]) {
      const there = convertWithTable(amt, "USD", "EUR", T);
      const back = convertWithTable(there, "EUR", "USD", T);
      expect(Math.abs(back - amt)).toBeLessThanOrEqual(Math.ceil(amt / 1e6) + 1);
    }
  });
  it("cross rate goes via INR (GBP 100 INR vs USD 83 INR)", () => {
    expect(Math.abs(convertWithTable(8300, "USD", "GBP", T) - 6890)).toBeLessThanOrEqual(1);
  });
  it("hasAllRates", () => {
    expect(hasAllRates(T)).toBe(true);
    expect(hasAllRates({ ...T, rates: { ...T.rates, USD: "0" } })).toBe(false);
    expect(hasAllRates(null)).toBe(false);
  });
});

describe("buildRateTable", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const row = (quote: string, rate: string, ageH: number, source = "open.er-api.com") => ({
    base: "INR",
    quote,
    rate,
    asOf: "2026-11-01",
    source,
    createdAt: new Date(now.getTime() - ageH * 3_600_000),
  });
  const all = (ageH: number) => [
    row("USD", "0.012", ageH),
    row("EUR", "0.011", ageH),
    row("GBP", "0.01", ageH),
    row("CAD", "0.016", ageH),
  ];
  it("fresh rows are not stale", () => {
    const t = buildRateTable(all(1), now);
    expect(t.stale).toBe(false);
    expect(t.rates.USD).toBe("0.012");
    expect(hasAllRates(t)).toBe(true);
  });
  it("older than 6h is stale", () => {
    expect(buildRateTable(all(7), now).stale).toBe(true);
  });
  it("missing currency falls back to static and marks stale", () => {
    const t = buildRateTable([row("USD", "0.012", 1)], now);
    expect(t.stale).toBe(true);
    expect(t.rates.EUR).toBe(staticRateTable(now).rates.EUR);
  });
  it("empty gives the static table", () => {
    expect(buildRateTable([], now).source).toBe("static");
  });
  it("inverse rows (X->INR) are ignored", () => {
    const t = buildRateTable([{ ...row("INR", "83", 1), base: "USD" }], now);
    expect(t.source).toBe("static");
  });
});
