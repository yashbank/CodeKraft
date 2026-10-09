import { FX_RATE_SCALE, divRoundHalfUp, parseDecimalScaled, toSafeNumber } from "@/lib/money";

/** DB aggregates (bigint/numeric) arrive as integer strings; parse exactly via bigint, never Number(). */
export function toMinor(value: string | number | bigint | null | undefined): number {
  return toSafeNumber(BigInt(value ?? 0));
}

/** `amount × numerator / denominator`, rounded half away from zero, exact via bigint. */
export function prorate(amountMinor: number, numerator: number, denominator: number): number {
  return toSafeNumber(
    divRoundHalfUp(BigInt(amountMinor) * BigInt(numerator), BigInt(denominator)),
    "prorated amount",
  );
}

/**
 * `amount × rate` (decimal-string rate), rounded half toward +infinity like `Math.round`, so a
 * negative reversal of x.5 rounds toward zero and still nets with its positive counterpart.
 */
export function toInrMinor(amountMinor: number, rate: string): number {
  const denominator = 10n ** BigInt(FX_RATE_SCALE);
  const scaled = BigInt(amountMinor) * parseDecimalScaled(rate, FX_RATE_SCALE);
  let rounded = divRoundHalfUp(scaled, denominator);
  if (scaled < 0n && (-scaled % denominator) * 2n === denominator) rounded += 1n; // exact half → toward +∞
  return toSafeNumber(rounded, "INR amount");
}
