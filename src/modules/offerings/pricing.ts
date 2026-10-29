/**
 * Offering pricing helpers (docs/05 §3, docs/06 §2.2, PHASE-03 P3.7).
 * Handles multi-currency pricing with fallback to FX rates when no explicit currency row is present.
 */
import type { Currency } from "@/lib/money";
import { convertMinor, format } from "@/lib/money";
import { getFxProvider } from "@/lib/fx";
import type { OfferingPrice } from "../../../drizzle/schema/offerings";
import type { OfferingPriceView } from "./types";

export async function resolveOfferingPrice(
  prices: OfferingPrice[],
  displayCurrency: Currency,
): Promise<OfferingPriceView | null> {
  if (prices.length === 0) return null;

  // 1. Look for explicit price in displayCurrency
  const explicitRow = prices.find((p) => p.currency === displayCurrency);
  if (explicitRow) {
    return {
      currency: displayCurrency,
      amountMinor: explicitRow.amountMinor,
      compareAtMinor: explicitRow.compareAtMinor ?? null,
      explicit: true,
    };
  }

  // 2. Fall back to base INR price converted via FX
  const basePrice = prices.find((p) => p.currency === "INR");
  if (!basePrice) {
    return null;
  }

  const quote = await getFxProvider().getRate("INR", displayCurrency);
  const amountMinor = convertMinor(basePrice.amountMinor, quote.rate);
  const compareAtMinor =
    basePrice.compareAtMinor !== null && basePrice.compareAtMinor !== undefined
      ? convertMinor(basePrice.compareAtMinor, quote.rate)
      : null;

  return {
    currency: displayCurrency,
    amountMinor,
    compareAtMinor,
    explicit: false,
  };
}

export function formatOfferingPrice(price: OfferingPriceView): string {
  return format({ amountMinor: price.amountMinor, currency: price.currency });
}

/**
 * Lowest "from" price for a product card in `displayCurrency`: the cheapest explicit price in that
 * currency, else the cheapest INR price converted at the latest rate (`approx: true`). If no rate
 * is available the unconverted cheapest price is returned (never hides the price).
 */
export async function cardFromPrice(
  rows: readonly { amountMinor: number; currency: string }[],
  displayCurrency: Currency,
): Promise<{ money: { amountMinor: number; currency: Currency }; approx: boolean } | null> {
  const cheapest = (pool: typeof rows) =>
    pool.reduce((a, b) => (a.amountMinor <= b.amountMinor ? a : b));
  const own = rows.filter((r) => r.currency === displayCurrency);
  if (own.length > 0) {
    const r = cheapest(own);
    return { money: { amountMinor: r.amountMinor, currency: displayCurrency }, approx: false };
  }
  const inr = rows.filter((r) => r.currency === "INR");
  if (inr.length > 0) {
    try {
      const quote = await getFxProvider().getRate("INR", displayCurrency);
      return {
        money: {
          amountMinor: convertMinor(cheapest(inr).amountMinor, quote.rate),
          currency: displayCurrency,
        },
        approx: true,
      };
    } catch {
      // no stored/static rate: fall through to the unconverted price
    }
  }
  if (rows.length === 0) return null;
  const r = cheapest(rows);
  return { money: { amountMinor: r.amountMinor, currency: r.currency as Currency }, approx: false };
}
