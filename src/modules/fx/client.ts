/**
 * FX client & mathematical utilities — docs/04 §4, docs/06 §3.3, TM-13.
 * Fetches from open.er-api.com, checks ±20% bounds vs previous rates,
 * computes 8-decimal inverse and cross-rates using pure integer arithmetic on bigint.
 */
import { CURRENCIES, divRoundHalfUp, parseDecimalScaled, type Currency } from "@/lib/money";
import { AppError, ErrorCode } from "@/lib/errors";
import { STATIC_FX_TABLE } from "@/lib/fx";
import { FX_STALE_AFTER_DAYS } from "./types";

export const FX_RATE_DECIMALS = 8;
const SCALE_MULTIPLIER = 10n ** BigInt(FX_RATE_DECIMALS);

/** Format scaled bigint back to an 8-decimal string without floats. */
export function format8Decimals(scaled: bigint): string {
  if (scaled <= 0n) {
    throw new RangeError(`FX rate must be positive, got ${scaled}`);
  }
  const s = scaled.toString();
  if (s.length <= FX_RATE_DECIMALS) {
    return `0.${s.padStart(FX_RATE_DECIMALS, "0")}`;
  }
  const whole = s.slice(0, s.length - FX_RATE_DECIMALS);
  const frac = s.slice(s.length - FX_RATE_DECIMALS);
  return `${whole}.${frac}`;
}

/** Convert a numeric or string value to an exact 8-decimal string. */
export function to8DecimalString(val: number | string): string {
  if (typeof val === "number") {
    if (!Number.isFinite(val) || val <= 0) {
      throw new TypeError(`Invalid FX rate number: ${val}`);
    }
    return val.toFixed(FX_RATE_DECIMALS);
  }
  const str = val.trim();
  if (!/^\+?\d+(?:\.\d+)?$/.test(str)) {
    throw new TypeError(`Invalid FX rate string: ${str}`);
  }
  const [whole, frac = ""] = str.split(".");
  if (frac.length > FX_RATE_DECIMALS) {
    const scaled = parseDecimalScaled(
      str.slice(0, (whole?.length ?? 1) + 1 + FX_RATE_DECIMALS),
      FX_RATE_DECIMALS,
    );
    return format8Decimals(scaled);
  }
  return `${whole}.${frac.padEnd(FX_RATE_DECIMALS, "0")}`;
}

/**
 * Invert a rate (e.g. INR/USD -> USD/INR) with 8 decimals using pure bigint arithmetic.
 * Rate = S / 10^8
 * Inverse = 1 / (S / 10^8) = 10^8 / S
 * Scaled to 8 decimals = (10^8 * 10^8) / S = 10^16 / S
 */
export function invertRate(rateStr: string): string {
  const scaled = parseDecimalScaled(rateStr, FX_RATE_DECIMALS);
  if (scaled <= 0n) {
    throw new RangeError("Rate must be greater than zero");
  }
  const invScaled = divRoundHalfUp(10n ** 16n, scaled);
  return format8Decimals(invScaled);
}

/**
 * Compute cross-rate between two currencies via base currency (INR):
 * rate(A/B) = rate(A/INR) * rate(INR/B)
 */
export function computeCrossRate(baseToInrRateStr: string, inrToQuoteRateStr: string): string {
  const s1 = parseDecimalScaled(baseToInrRateStr, FX_RATE_DECIMALS);
  const s2 = parseDecimalScaled(inrToQuoteRateStr, FX_RATE_DECIMALS);
  const crossScaled = divRoundHalfUp(s1 * s2, SCALE_MULTIPLIER);
  return format8Decimals(crossScaled);
}

/**
 * TM-13 Sanity bounds check: ±20% vs previous day rate.
 * prev * 0.80 <= next <= prev * 1.20
 */
export function isWithinBounds(prevRateStr: string, newRateStr: string): boolean {
  const prev = parseDecimalScaled(prevRateStr, FX_RATE_DECIMALS);
  const next = parseDecimalScaled(newRateStr, FX_RATE_DECIMALS);
  if (prev <= 0n || next <= 0n) return false;

  const lower = divRoundHalfUp(prev * 80n, 100n);
  const upper = divRoundHalfUp(prev * 120n, 100n);
  return next >= lower && next <= upper;
}

/**
 * Independent sanity check for an INR -> quote rate: within 50% of the static table, never <= 0,
 * never exactly 1. Unlike isWithinBounds it does not trust the stored rate, so a stored bad rate
 * cannot block its own correction.
 */
export function isSaneInrRate(quote: string, rate: string): boolean {
  const n = Number(rate);
  if (!(n > 0) || n === 1) return false;
  const ref = STATIC_FX_TABLE[`INR/${quote}`];
  return ref === undefined || (n >= Number(ref) * 0.5 && n <= Number(ref) * 1.5);
}

/**
 * Checks if a rate's asOf date is older than thresholdDays (default 3).
 */
export function isRateStale(
  asOf: string,
  now: Date = new Date(),
  thresholdDays: number = FX_STALE_AFTER_DAYS,
): boolean {
  const [year, month, day] = asOf.split("-").map(Number);
  if (!year || !month || !day) return true;
  const asOfTime = Date.UTC(year, month - 1, day);
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = (nowUtc - asOfTime) / (86400 * 1000);
  return diffDays > thresholdDays;
}

export interface OpenErResponse {
  result: string;
  base_code: string;
  rates: Record<string, number | string>;
  time_last_update_utc?: string;
  [key: string]: unknown;
}

export const FX_FETCH_TIMEOUT_MS = 5000;
export const FX_PRIMARY_SOURCE = "open.er-api.com";
export const FX_FALLBACK_SOURCE = "frankfurter.app";

/** All currencies except the INR base. */
export const FX_QUOTE_CURRENCIES: readonly Currency[] = CURRENCIES.filter((c) => c !== "INR");
const FALLBACK_URL = `https://api.${FX_FALLBACK_SOURCE}/latest?from=INR&to=${FX_QUOTE_CURRENCIES.join(",")}`;

export interface FetchedRates {
  base: "INR";
  /** Units of each currency per 1 INR, 8-decimal strings. */
  rates: Record<string, string>;
  asOf: string;
  source: string;
}

/** Keeps only positive finite numeric quotes for known currencies. */
function pickRates(raw: Record<string, unknown> | undefined): Record<string, string> {
  const rates: Record<string, string> = {};
  for (const curr of FX_QUOTE_CURRENCIES) {
    const v = raw?.[curr];
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) rates[curr] = to8DecimalString(n);
  }
  return rates;
}

async function getJson(url: string, fetchFn: typeof fetch): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FX_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw new AppError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      `Failed to reach FX provider: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new AppError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      `FX provider returned HTTP status ${res.status}`,
    );
  }
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    throw new AppError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      `Failed to parse FX provider JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Fetch base INR rates from open.er-api.com (or custom / FX_API_URL, same response shape). */
export async function fetchOpenErRates(
  customUrl?: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ base: "INR"; rates: Record<string, string>; asOf: string }> {
  const url = customUrl || process.env.FX_API_URL || `https://${FX_PRIMARY_SOURCE}/v6/latest/INR`;
  const data = (await getJson(url, fetchFn)) as unknown as OpenErResponse;
  if (data.result !== "success" || !data.rates) {
    throw new AppError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      `FX provider reported error: ${String(data.result || "unknown")}`,
    );
  }
  // A provider URL may be pinned to another base (/latest/USD): re-base to INR instead of
  // storing foreign-base rates as INR rates. No base_code or no INR quote = unusable.
  let raw: Record<string, unknown> = data.rates;
  if (data.base_code !== "INR") {
    const inr = Number(data.rates.INR);
    if (typeof data.base_code !== "string" || !(inr > 0)) {
      throw new AppError(
        ErrorCode.UPSTREAM_UNAVAILABLE,
        `FX provider base_code is ${String(data.base_code)} and cannot be re-based to INR`,
      );
    }
    raw = { [data.base_code]: 1, ...data.rates };
    for (const q of Object.keys(raw)) raw[q] = Number(raw[q]) / inr;
  }
  const rates = pickRates(raw);
  if (Object.keys(rates).length === 0) {
    throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "FX provider returned no usable rates");
  }
  return { base: "INR", rates, asOf: new Date().toISOString().slice(0, 10) };
}

/** frankfurter.app (keyless, ECB): `{ base: "INR", rates: { USD: 0.012 } }`. */
export async function fetchFrankfurterRates(fetchFn: typeof fetch = fetch): Promise<FetchedRates> {
  const data = await getJson(FALLBACK_URL, fetchFn);
  if (data.base !== "INR") {
    throw new AppError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      `Fallback FX provider base is ${String(data.base)}, expected INR`,
    );
  }
  const rates = pickRates(data.rates as Record<string, unknown> | undefined);
  if (Object.keys(rates).length === 0) {
    throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "Fallback FX provider returned no rates");
  }
  return {
    base: "INR",
    rates,
    asOf: new Date().toISOString().slice(0, 10),
    source: FX_FALLBACK_SOURCE,
  };
}

/** Primary provider, then keyless fallback. Throws only if both fail (message lists both). */
export async function fetchRatesWithFallback(
  fetchFn: typeof fetch = fetch,
  customUrl?: string,
): Promise<FetchedRates> {
  try {
    const r = await fetchOpenErRates(customUrl, fetchFn);
    const custom = customUrl || process.env.FX_API_URL;
    return { ...r, source: custom ? new URL(custom).host : FX_PRIMARY_SOURCE };
  } catch (primaryErr) {
    try {
      return await fetchFrankfurterRates(fetchFn);
    } catch (fallbackErr) {
      const m = (e: unknown) => (e instanceof Error ? e.message : String(e));
      throw new AppError(
        ErrorCode.UPSTREAM_UNAVAILABLE,
        `All FX providers failed: ${m(primaryErr)}; ${m(fallbackErr)}`,
      );
    }
  }
}
