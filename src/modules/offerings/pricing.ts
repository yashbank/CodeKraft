/**
 * Display-price resolution (D-502, D-408, MASTER_SPEC §4.8): an explicit `offering_prices` row in
 * the display currency wins; otherwise the base-currency row is converted with the FX rate
 * (`displayIsConverted: true`, "approx." in the UI). Pure integer arithmetic via `lib/money`.
 */
import {
  type Currency,
  FX_RATE_SCALE,
  convertMinor,
  divRoundHalfUp,
  money,
  type Money,
  parseDecimalScaled,
  toSafeNumber,
} from "@/lib/money";
import type { OfferingPriceView } from "./types";

export interface PriceRowLike {
  currency: string;
  amountMinor: number;
  compareAtMinor: number | null;
}

export interface ResolvedPrice {
  base: Money;
  display: Money;
  compareAt: Money | null;
  displayIsConverted: boolean;
}

/** Decimal-string rate `1 base = rate display`, or `null` when unavailable / same currency. */
export type RateLookup = (base: Currency, quote: Currency) => Promise<string | null>;

export function baseRow<T extends PriceRowLike>(prices: readonly T[], baseCurrency: Currency) {
  return prices.find((p) => p.currency === baseCurrency);
}

/**
 * `null` when the offering has no base-currency row (it is not sellable, API-CAT-04). Without a
 * rate and without an explicit row the base price is shown as-is (currency = base), never a float.
 */
export function resolvePrice(
  prices: readonly PriceRowLike[],
  baseCurrency: Currency,
  displayCurrency: Currency,
  rate: string | null,
): ResolvedPrice | null {
  const base = baseRow(prices, baseCurrency);
  if (base === undefined) return null;
  const baseMoney = money(base.amountMinor, baseCurrency);
  const explicit = prices.find((p) => p.currency === displayCurrency);
  if (explicit !== undefined) {
    return {
      base: baseMoney,
      display: money(explicit.amountMinor, displayCurrency),
      compareAt:
        explicit.compareAtMinor === null ? null : money(explicit.compareAtMinor, displayCurrency),
      displayIsConverted: false,
    };
  }
  if (rate === null || baseCurrency === displayCurrency) {
    return {
      base: baseMoney,
      display: baseMoney,
      compareAt: base.compareAtMinor === null ? null : money(base.compareAtMinor, baseCurrency),
      displayIsConverted: false,
    };
  }
  return {
    base: baseMoney,
    display: money(convertMinor(base.amountMinor, rate), displayCurrency),
    compareAt:
      base.compareAtMinor === null
        ? null
        : money(convertMinor(base.compareAtMinor, rate), displayCurrency),
    displayIsConverted: true,
  };
}

export function toPriceViews(prices: readonly PriceRowLike[]): OfferingPriceView[] {
  return prices.map((p) => ({
    currency: p.currency as Currency,
    amountMinor: p.amountMinor,
    compareAtMinor: p.compareAtMinor,
    explicit: true,
  }));
}

/** Convert a display-currency amount back to base (price filters, docs/06 API-CAT-30). */
export function toBaseMinor(displayMinor: number, rateBaseToDisplay: string | null): number {
  if (rateBaseToDisplay === null) return displayMinor;
  const rateScaled = parseDecimalScaled(rateBaseToDisplay, FX_RATE_SCALE);
  if (rateScaled === 0n) return displayMinor;
  // amount_base = amount_display / rate, rounded half up, in integer arithmetic.
  return toSafeNumber(
    divRoundHalfUp(BigInt(displayMinor) * 10n ** BigInt(FX_RATE_SCALE), rateScaled),
    "base amount",
  );
}
