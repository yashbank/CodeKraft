import { beforeEach, describe, expect, it } from "vitest";
import { setFxProvider, StaticFxProvider } from "@/lib/fx";
import { resetRateTableCache } from "@/lib/rate-table";
import { cardFromPrice, resolveOfferingPrice } from "@/modules/offerings/pricing";
import type { OfferingPrice } from "@/modules/offerings/types";

// Known table (units per 1 INR): USD 0.012, EUR 0.011, GBP 0.0095, CAD 0.0163
beforeEach(() => {
  setFxProvider(new StaticFxProvider());
  resetRateTableCache();
});

const row = (currency: string, amountMinor: number, compareAtMinor: number | null = null) =>
  ({ offeringId: "o", currency, amountMinor, compareAtMinor }) as unknown as OfferingPrice;

describe("viewer-currency conversion from any stored currency", () => {
  it("converts a USD-only price to EUR via the INR cross rate", async () => {
    // 100.00 USD -> 0.011/0.012 * 10000 = 9166.67 -> 9167 minor
    const r = await resolveOfferingPrice([row("USD", 10000, 20000)], "EUR");
    expect(r).toMatchObject({
      currency: "EUR",
      amountMinor: 9167,
      compareAtMinor: 18333,
      explicit: false,
    });
  });

  it("keeps an explicit row in the viewer currency untouched", async () => {
    const r = await resolveOfferingPrice([row("USD", 10000), row("EUR", 9000)], "EUR");
    expect(r).toMatchObject({ amountMinor: 9000, explicit: true });
  });

  it("card from-price converts every row and keeps the cheapest", async () => {
    // INR 5000.00 -> EUR 55.00 (5500) ; USD 70.00 -> EUR 64.17 ; min 5500
    const r = await cardFromPrice(
      [
        { amountMinor: 500000, currency: "INR" },
        { amountMinor: 7000, currency: "USD" },
      ],
      "EUR",
    );
    expect(r).toEqual({ money: { amountMinor: 5500, currency: "EUR" }, approx: true });
  });

  it("same-currency card price is not approximate", async () => {
    const r = await cardFromPrice([{ amountMinor: 7000, currency: "USD" }], "USD");
    expect(r).toEqual({ money: { amountMinor: 7000, currency: "USD" }, approx: false });
  });
});
