/**
 * `open.er-api.com` client + pure rate arithmetic (PHASE-03 P3.12; docs/04 §7.8, D-515, TM-13).
 *
 * The provider answers `{ result: "success", base_code: "INR", rates: { USD: 0.0120, … } }`.
 * Rates become 8-decimal strings immediately (`numeric(18,8)`), every derived value (inverse,
 * deviation) is computed on scaled bigints in `lib/money` style — no float arithmetic.
 */
import { AppError, ErrorCode } from "@/lib/errors";
import { type Currency, FX_RATE_SCALE, divRoundHalfUp, isCurrency, parseDecimalScaled } from "@/lib/money";
import { FX_STALE_AFTER_DAYS } from "./types";

export const FX_FETCH_TIMEOUT_MS = 10_000;
/** Reject a fetched rate that moves more than ±20 % against the previous stored rate (TM-13). */
export const FX_MAX_DEVIATION_BPS = 2_000;

const SCALE = 10n ** BigInt(FX_RATE_SCALE);

/** `123456789n` (scale 8) → `"1.23456789"`. */
export function formatScaled(scaled: bigint): string {
  if (scaled < 0n) throw new RangeError("rate must be positive");
  const text = scaled.toString().padStart(FX_RATE_SCALE + 1, "0");
  return `${text.slice(0, -FX_RATE_SCALE)}.${text.slice(-FX_RATE_SCALE)}`;
}

/** Provider float → 8-decimal string. Formatting only; no arithmetic is done on the float. */
export function rateFromNumber(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "FX provider returned an invalid rate");
  }
  const text = value.toFixed(FX_RATE_SCALE);
  if (parseDecimalScaled(text, FX_RATE_SCALE) === 0n) {
    throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "FX provider returned a zero rate");
  }
  return text;
}

/** `1 / rate`, rounded half-up at 8 decimals, all on bigints. */
export function invertRate(rate: string): string {
  const scaled = parseDecimalScaled(rate, FX_RATE_SCALE);
  if (scaled === 0n) throw new RangeError("cannot invert a zero rate");
  return formatScaled(divRoundHalfUp(SCALE * SCALE, scaled));
}

/** `|next − prev| × 10000 ≤ prev × maxBps` on scaled bigints. */
export function withinBounds(next: string, prev: string, maxBps = FX_MAX_DEVIATION_BPS): boolean {
  const n = parseDecimalScaled(next, FX_RATE_SCALE);
  const p = parseDecimalScaled(prev, FX_RATE_SCALE);
  if (p === 0n) return true;
  const delta = n > p ? n - p : p - n;
  return delta * 10_000n <= p * BigInt(maxBps);
}

/** A last success older than `FX_STALE_AFTER_DAYS` (or none at all) is stale (docs/06 §3.3). */
export function isStale(lastSuccessAsOf: string | null, now: Date, days = FX_STALE_AFTER_DAYS): boolean {
  if (lastSuccessAsOf === null) return true;
  const last = Date.parse(`${lastSuccessAsOf}T00:00:00.000Z`);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > days * 86_400_000;
}

export interface ProviderRates {
  base: Currency;
  /** `quote → rate` (1 base = rate quote), 8-decimal strings. */
  rates: Partial<Record<Currency, string>>;
}

/** Validate and normalise a provider payload for the requested quotes. */
export function parseProviderResponse(
  json: unknown,
  base: Currency,
  quotes: readonly Currency[],
): ProviderRates {
  const body = json as { result?: unknown; base_code?: unknown; rates?: unknown } | null;
  if (body === null || typeof body !== "object" || body.result !== "success") {
    throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "FX provider returned an error");
  }
  if (typeof body.base_code !== "string" || body.base_code.toUpperCase() !== base) {
    throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "FX provider base currency mismatch");
  }
  const raw = body.rates;
  if (raw === null || typeof raw !== "object") {
    throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "FX provider returned no rates");
  }
  const rates: Partial<Record<Currency, string>> = {};
  for (const quote of quotes) {
    if (quote === base || !isCurrency(quote)) continue;
    const value = (raw as Record<string, unknown>)[quote];
    if (value === undefined) continue;
    rates[quote] = rateFromNumber(value);
  }
  return { base, rates };
}

export type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** `GET <FX_API_URL>/<base>` with a timeout; throws `UPSTREAM_UNAVAILABLE` on any failure. */
export async function fetchProviderRates(
  fetchFn: FetchLike,
  apiUrl: string,
  base: Currency,
  quotes: readonly Currency[],
  timeoutMs = FX_FETCH_TIMEOUT_MS,
): Promise<ProviderRates> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${apiUrl.replace(/\/+$/, "")}/${base}`;
    const res = await fetchFn(url, { signal: controller.signal });
    if (!res.ok) {
      throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, `FX provider HTTP ${String(res.status)}`);
    }
    return parseProviderResponse(await res.json(), base, quotes);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "FX provider unreachable", { cause: err });
  } finally {
    clearTimeout(timer);
  }
}
