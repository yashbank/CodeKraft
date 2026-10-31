/**
 * Offering pricing helpers (docs/05 §3, docs/06 §2.2, PHASE-03 P3.7).
 * Handles multi-currency pricing with fallback to FX rates when no explicit currency row is present.
 */
import type { Currency } from "@/lib/money";
import { format } from "@/lib/money";
import { convertAmount } from "@/lib/rate-table";
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

  // 2. Convert the stored price (INR preferred, else any stored currency) into the viewer's currency
  const source = prices.find((p) => p.currency === "INR") ?? prices[0];
  if (!source) return null;
  const from = source.currency as Currency;
  try {
    return {
      currency: displayCurrency,
      amountMinor: await convertAmount(source.amountMinor, from, displayCurrency),
      compareAtMinor:
        source.compareAtMinor !== null && source.compareAtMinor !== undefined
          ? await convertAmount(source.compareAtMinor, from, displayCurrency)
          : null,
      explicit: false,
    };
  } catch {
    // no rate: show the stored price in its own currency rather than a wrong number
    return {
      currency: from,
      amountMinor: source.amountMinor,
      compareAtMinor: source.compareAtMinor ?? null,
      explicit: true,
    };
  }
}

export function formatOfferingPrice(price: OfferingPriceView): string {
  return format({ amountMinor: price.amountMinor, currency: price.currency });
}

/**
 * Lowest "from" price for a product card in `displayCurrency`: the cheapest explicit price in that
 * currency, else every stored price converted at the latest rate and the cheapest kept (`approx: true`).
 * If no rate is available the unconverted cheapest price is returned (never hides the price).
 */
export async function cardFromPrice(
  rows: readonly { amountMinor: number; currency: string }[],
  displayCurrency: Currency,
): Promise<{ money: { amountMinor: number; currency: Currency }; approx: boolean } | null> {
  if (rows.length === 0) return null;
  const cheapest = (pool: typeof rows) =>
    pool.reduce((a, b) => (a.amountMinor <= b.amountMinor ? a : b));
  const own = rows.filter((r) => r.currency === displayCurrency);
  if (own.length > 0) {
    const r = cheapest(own);
    return { money: { amountMinor: r.amountMinor, currency: displayCurrency }, approx: false };
  }
  try {
    const converted = await Promise.all(
      rows.map(async (r) => ({
        amountMinor: await convertAmount(r.amountMinor, r.currency as Currency, displayCurrency),
        currency: displayCurrency as string,
      })),
    );
    return {
      money: { amountMinor: cheapest(converted).amountMinor, currency: displayCurrency },
      approx: true,
    };
  } catch {
    // no rate: fall through to the unconverted price
  }
  const r = cheapest(
    rows.filter((x) => x.currency === "INR").length
      ? rows.filter((x) => x.currency === "INR")
      : rows,
  );
  return { money: { amountMinor: r.amountMinor, currency: r.currency as Currency }, approx: false };
}
