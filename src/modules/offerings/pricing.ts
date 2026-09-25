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
