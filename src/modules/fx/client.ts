/**
 * FX client & mathematical utilities — docs/04 §4, docs/06 §3.3, TM-13.
 * Fetches from open.er-api.com, checks ±20% bounds vs previous rates,
 * computes 8-decimal inverse and cross-rates using pure integer arithmetic on bigint.
 */
import { divRoundHalfUp, parseDecimalScaled, type Currency } from "@/lib/money";
import { AppError, ErrorCode } from "@/lib/errors";
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

/**
 * Fetch base INR rates from open.er-api.com (or mock / custom FX_API_URL).
 */
export async function fetchOpenErRates(
  customUrl?: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ base: "INR"; rates: Record<string, string>; asOf: string }> {
  const url = customUrl || process.env.FX_API_URL || "https://open.er-api.com/v6/latest/INR";

  let res: Response;
  try {
    res = await fetchFn(url, { headers: { Accept: "application/json" } });
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

  let data: OpenErResponse;
  try {
    data = (await res.json()) as OpenErResponse;
  } catch (err) {
    throw new AppError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      `Failed to parse FX provider JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (data.result !== "success" || !data.rates) {
    throw new AppError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      `FX provider reported error: ${data.result || "unknown"}`,
    );
  }

  const rates: Record<string, string> = {};
  const targetCurrencies: Currency[] = ["USD", "EUR", "GBP", "CAD"];

  for (const curr of targetCurrencies) {
    const rawVal = data.rates[curr];
    if (rawVal !== undefined) {
      rates[curr] = to8DecimalString(rawVal);
    }
  }

  const asOf = new Date().toISOString().slice(0, 10);

  return {
    base: "INR",
    rates,
    asOf,
  };
}
