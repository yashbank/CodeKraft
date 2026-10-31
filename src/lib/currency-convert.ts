/**
 * Single conversion contract for the whole app (client-safe, pure).
 * A `RateTable` is "units of each currency per 1 INR" (decimal strings, <= 8 decimals), so
 * from -> to = rates[to] / rates[from]. Amounts stay in minor units; stored amounts are never
 * rewritten, only converted for display. INR is always "1".
 */
import { CURRENCIES, FX_RATE_SCALE, parseDecimalScaled, type Currency } from "./money";

export interface RateTable {
  base: "INR";
  rates: Record<Currency, string>;
  /** ISO timestamp of the last successful fetch (or "static" fallback marker time). */
  fetchedAt: string;
  /** true when older than the freshness window or from the static fallback. */
  stale: boolean;
  source: string;
}

const SCALE = 10n ** BigInt(FX_RATE_SCALE);

/** Cross rate from -> to as a scaled bigint (units of `to` per 1 `from`, x 1e8). */
export function crossRateScaled(from: Currency, to: Currency, t: RateTable): bigint {
  if (from === to) return SCALE;
  const f = parseDecimalScaled(t.rates[from], FX_RATE_SCALE);
  const g = parseDecimalScaled(t.rates[to], FX_RATE_SCALE);
  if (f <= 0n || g <= 0n) throw new RangeError(`missing FX rate for ${from}/${to}`);
  return (g * SCALE + f / 2n) / f;
}

/** Convert a minor amount between currencies, rounded half away from zero. Pure. */
export function convertWithTable(
  amountMinor: number,
  from: Currency,
  to: Currency,
  t: RateTable,
): number {
  if (from === to) return amountMinor;
  const rate = crossRateScaled(from, to, t);
  const n = BigInt(amountMinor) * rate;
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const q = (abs + SCALE / 2n) / SCALE;
  return Number(neg ? -q : q);
}

export function hasAllRates(t: Partial<RateTable> | null | undefined): t is RateTable {
  return !!t?.rates && CURRENCIES.every((c) => Number(t.rates?.[c]) > 0);
}
