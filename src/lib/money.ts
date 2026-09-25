/**
 * Money — MASTER_SPEC §4 rule 8, NFR-DATA-03, docs/06 §1.9, D-515.
 *
 * Money is always `{ amountMinor, currency }` with `amountMinor` a safe integer in the currency's
 * minor unit (paise, cents). Every computation here is integer arithmetic on `bigint`; there are no
 * floats, no `Number(...)` coercions of decimals, no `Math.round`. This module is the single
 * implementation of split rounding (MASTER_SPEC §7 "Split rounding"): P4 finance calls
 * `allocateLargestRemainder`, never its own division.
 */

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "CAD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Money {
  amountMinor: number;
  currency: Currency;
}

/** Default display locale per currency; INR uses lakh/crore grouping (`₹1,23,456.78`). */
export const CURRENCY_LOCALE: Readonly<Record<Currency, string>> = Object.freeze({
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  CAD: "en-CA",
});

/** All five supported currencies have two minor-unit digits. */
export const FRACTION_DIGITS = 2;

const BPS_DENOMINATOR = 10_000n;
/** FX rates are `numeric(18,8)` (docs/05 T-fx_rates): eight decimal places. */
export const FX_RATE_SCALE = 8;
const FX_RATE_DENOMINATOR = 10n ** BigInt(FX_RATE_SCALE);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function assertCurrency(value: unknown): Currency {
  if (!isCurrency(value)) throw new TypeError(`unsupported currency: ${String(value)}`);
  return value;
}

/** Minor amounts must be safe integers (bigint columns hold more, but JS numbers do not). */
export function assertMinor(value: number, what = "amountMinor"): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${what} must be a safe integer, got ${String(value)}`);
  }
  return value;
}

/** Narrow a bigint back to a safe-integer number or throw (never silently lose precision). */
export function toSafeNumber(value: bigint, what = "amount"): number {
  if (value > MAX_SAFE) throw new RangeError(`${what} exceeds Number.MAX_SAFE_INTEGER`);
  if (value < MIN_SAFE) throw new RangeError(`${what} is below Number.MIN_SAFE_INTEGER`);
  return Number(value);
}

export function money(amountMinor: number, currency: Currency): Money {
  return { amountMinor: assertMinor(amountMinor), currency: assertCurrency(currency) };
}

export function assertMoney(value: Money): Money {
  return money(value.amountMinor, value.currency);
}

export function zero(currency: Currency): Money {
  return money(0, currency);
}

function sameCurrency(a: Money, b: Money): Currency {
  assertMoney(a);
  assertMoney(b);
  if (a.currency !== b.currency) {
    throw new TypeError(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return a.currency;
}

export function add(a: Money, b: Money): Money {
  const currency = sameCurrency(a, b);
  return money(toSafeNumber(BigInt(a.amountMinor) + BigInt(b.amountMinor), "sum"), currency);
}

export function sub(a: Money, b: Money): Money {
  const currency = sameCurrency(a, b);
  return money(toSafeNumber(BigInt(a.amountMinor) - BigInt(b.amountMinor), "difference"), currency);
}

export function neg(m: Money): Money {
  assertMoney(m);
  return money(-m.amountMinor, m.currency);
}

export function isZero(m: Money): boolean {
  return assertMoney(m).amountMinor === 0;
}

export function isNegative(m: Money): boolean {
  return assertMoney(m).amountMinor < 0;
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  sameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

export function equals(a: Money, b: Money): boolean {
  return compare(a, b) === 0;
}

/**
 * Integer division rounding half away from zero (financial "round half up"): 5/2 → 3, -5/2 → -3,
 * 4/3 → 1. `bigint` `/` truncates toward zero, so the remainder decides the correction.
 */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError("division by zero");
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let q = n / d;
  if ((n % d) * 2n >= d) q += 1n;
  return negative ? -q : q;
}

/** `amount × bps / 10 000`, rounded half away from zero. `bps` may be negative (discounts). */
export function mulBps(m: Money, bps: number): Money {
  assertMoney(m);
  assertMinor(bps, "bps");
  const result = divRoundHalfUp(BigInt(m.amountMinor) * BigInt(bps), BPS_DENOMINATOR);
  return money(toSafeNumber(result, "mulBps result"), m.currency);
}

interface Remainder {
  index: number;
  remainder: bigint;
  weight: bigint;
}

/**
 * Largest-remainder allocation (MASTER_SPEC §7 "Split rounding", docs/10 FI-02).
 *
 * Splits `totalMinor` across `weightsBps` (non-negative integers, normalised by their sum — they
 * need not add up to 10 000). Guarantees: Σ parts = total exactly; every part is within one minor
 * unit of its ideal share (floor or floor + 1); deterministic — leftover units go to the largest
 * fractional remainders, ties broken by larger weight, then lower index. Negative totals are
 * allocated on the absolute value and negated.
 */
export function allocateLargestRemainder(
  totalMinor: number,
  weightsBps: readonly number[],
): number[] {
  assertMinor(totalMinor, "totalMinor");
  if (weightsBps.length === 0) throw new RangeError("at least one weight is required");
  let weightSum = 0n;
  const weights = weightsBps.map((w) => {
    if (!Number.isSafeInteger(w) || w < 0) {
      throw new RangeError(`weights must be non-negative integers, got ${String(w)}`);
    }
    const big = BigInt(w);
    weightSum += big;
    return big;
  });
  if (weightSum === 0n) throw new RangeError("weights must not all be zero");

  const negative = totalMinor < 0;
  const total = BigInt(negative ? -totalMinor : totalMinor);
  const parts: bigint[] = [];
  const remainders: Remainder[] = [];
  let assigned = 0n;
  weights.forEach((weight, index) => {
    const scaled = total * weight;
    const floor = scaled / weightSum;
    parts.push(floor);
    assigned += floor;
    remainders.push({ index, remainder: scaled % weightSum, weight });
  });

  remainders.sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    if (a.weight !== b.weight) return a.weight > b.weight ? -1 : 1;
    return a.index - b.index;
  });
  let leftover = total - assigned; // 0 ≤ leftover < weights.length
  for (const { index } of remainders) {
    if (leftover === 0n) break;
    parts[index] = (parts[index] as bigint) + 1n;
    leftover -= 1n;
  }
  return parts.map((p) => toSafeNumber(negative ? -p : p, "allocation part"));
}

/**
 * Parse a non-negative decimal string (`"83.5"`, `"0.01200000"`) into an integer scaled by
 * `10^scale`, exactly. More fraction digits than `scale` is an error (never silently rounded).
 */
export function parseDecimalScaled(text: string, scale: number): bigint {
  assertMinor(scale, "scale");
  const m = /^\+?(\d+)(?:\.(\d*))?$/.exec(text.trim());
  if (m === null) throw new TypeError(`invalid decimal string: ${JSON.stringify(text)}`);
  const fraction = m[2] ?? "";
  if (fraction.length > scale) {
    throw new RangeError(`decimal string has more than ${String(scale)} fraction digits: ${text}`);
  }
  return BigInt((m[1] as string) + fraction.padEnd(scale, "0"));
}

/** Convert a minor amount by a decimal-string rate (≤ 8 decimals), rounded half away from zero. */
export function convertMinor(amountMinor: number, rate: string): number {
  assertMinor(amountMinor);
  const scaledRate = parseDecimalScaled(rate, FX_RATE_SCALE);
  return toSafeNumber(
    divRoundHalfUp(BigInt(amountMinor) * scaledRate, FX_RATE_DENOMINATOR),
    "converted amount",
  );
}

/** INR equivalent in paise for `fxRateToInr` (D-515): `amountMinor × rate`, rounded half up. */
export function toInrMinor(amountMinor: number, fxRateToInr: string): number {
  return convertMinor(amountMinor, fxRateToInr);
}

/** `123456` → `"1234.56"`, `-5` → `"-0.05"`. Pure string arithmetic. */
export function toDecimalString(amountMinor: number): string {
  assertMinor(amountMinor);
  const negative = amountMinor < 0;
  const digits = String(negative ? -amountMinor : amountMinor).padStart(FRACTION_DIGITS + 1, "0");
  const whole = digits.slice(0, digits.length - FRACTION_DIGITS);
  const fraction = digits.slice(digits.length - FRACTION_DIGITS);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Locale-aware display, e.g. `format({ amountMinor: 12345678, currency: "INR" })` → `₹1,23,456.78`.
 * The decimal string is handed to `Intl.NumberFormat` (exact string input, no float conversion).
 */
export function format(m: Money, locale?: string): string {
  assertMoney(m);
  const formatter = new Intl.NumberFormat(locale ?? CURRENCY_LOCALE[m.currency], {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: FRACTION_DIGITS,
    maximumFractionDigits: FRACTION_DIGITS,
  });
  return formatter.format(toDecimalString(m.amountMinor) as `${number}`);
}

const CURRENCY_SYMBOLS = /CA\$|US\$|[₹$€£]/g;
const CURRENCY_CODE_PREFIX = /^(?:INR|USD|EUR|GBP|CAD)\b/i;

/**
 * Parse user input such as `"1,23,456.78"`, `"₹ 1,234.50"`, `"-12"`, `".5"` into minor units
 * without floats. Group separators (`,`) and whitespace are ignored; more than two fraction
 * digits, or no digits at all, is an error.
 */
export function parseMinor(input: string, currency: Currency): number {
  assertCurrency(currency);
  const cleaned = input
    .trim()
    .replace(CURRENCY_CODE_PREFIX, "")
    .replace(CURRENCY_SYMBOLS, "")
    .replace(/[\s,]/g, "");
  const m = /^([+-])?(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (m === null) throw new TypeError(`invalid amount: ${JSON.stringify(input)}`);
  const whole = m[2] as string; // `(\d*)` always participates (possibly empty)
  const fraction = m[3] ?? "";
  if (whole === "" && fraction === "")
    throw new TypeError(`invalid amount: ${JSON.stringify(input)}`);
  const magnitude = BigInt((whole === "" ? "0" : whole) + fraction.padEnd(FRACTION_DIGITS, "0"));
  return toSafeNumber(m[1] === "-" ? -magnitude : magnitude, "parsed amount");
}
