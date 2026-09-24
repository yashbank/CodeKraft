/**
 * Date helpers for the Indian financial year (1 April – 31 March, Asia/Kolkata).
 * IST is a fixed UTC+05:30 with no DST, so a constant offset is exact; no date library needed.
 */

export const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
export const IST_TIME_ZONE = "Asia/Kolkata";

export interface IstParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** `YYYY-MM-DD` in IST */
  isoDate: string;
}

export type DateInput = Date | string | number;

export function toDate(input: DateInput): Date {
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(d.getTime())) throw new RangeError(`invalid date: ${String(input)}`);
  return d;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Calendar fields of an instant as seen on a clock in Asia/Kolkata. */
export function istParts(input: DateInput): IstParts {
  const shifted = new Date(toDate(input).getTime() + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  return {
    year,
    month,
    day,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    isoDate: `${year}-${pad2(month)}-${pad2(day)}`,
  };
}

export function nowIst(): IstParts {
  return istParts(new Date());
}

/** Financial-year label for the year that starts on 1 April `startYear`, e.g. 2026 → `2026-27`. */
export function fyLabel(startYear: number): string {
  if (!Number.isInteger(startYear)) throw new RangeError("startYear must be an integer");
  return `${startYear}-${pad2((startYear + 1) % 100)}`;
}

/** Start year of a `2026-27` label. */
export function fyStartYear(fy: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(fy);
  if (!m) throw new RangeError(`financial year must look like 2026-27, got ${fy}`);
  const start = Number.parseInt(m[1] as string, 10);
  if ((start + 1) % 100 !== Number.parseInt(m[2] as string, 10)) {
    throw new RangeError(`financial year label is inconsistent: ${fy}`);
  }
  return start;
}

/**
 * Indian financial year containing the instant, evaluated in Asia/Kolkata.
 * `fyFor('2027-03-31T18:29:59Z')` → `2026-27`; `fyFor('2027-03-31T18:30:00Z')` → `2027-28`.
 */
export function fyFor(input: DateInput): string {
  const { year, month } = istParts(input);
  return fyLabel(month >= 4 ? year : year - 1);
}

/** Instant at which the given FY (label or any instant inside it) begins: 1 April 00:00 IST. */
export function startOfFy(input: DateInput | string): Date {
  const startYear =
    typeof input === "string" && /^\d{4}-\d{2}$/.test(input)
      ? fyStartYear(input)
      : fyStartYear(fyFor(input));
  return new Date(Date.UTC(startYear, 3, 1) - IST_OFFSET_MS);
}

/** Instant at which the FY ends (exclusive): 1 April 00:00 IST of the following year. */
export function endOfFy(input: DateInput | string): Date {
  const start = startOfFy(input);
  return new Date(Date.UTC(start.getUTCFullYear() + 1, 3, 1) - IST_OFFSET_MS);
}

/** Add calendar months (UTC fields); the day is clamped to the target month's length. */
export function addMonths(input: DateInput, months: number): Date {
  if (!Number.isInteger(months)) throw new RangeError("months must be an integer");
  const d = toDate(input);
  const day = d.getUTCDate();
  const target = new Date(d.getTime());
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

export function addDays(input: DateInput, days: number): Date {
  if (!Number.isInteger(days)) throw new RangeError("days must be an integer");
  return new Date(toDate(input).getTime() + days * 86_400_000);
}

/** `YYYY-MM-DD` of an instant, in IST by default (payout `paidOn`, expense `incurredOn`) or UTC. */
export function isoDate(input: DateInput, zone: "IST" | "UTC" = "IST"): string {
  if (zone === "IST") return istParts(input).isoDate;
  const d = toDate(input);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** ISO-8601 UTC timestamp with milliseconds (docs/06 §1.9). */
export function isoTimestamp(input: DateInput = new Date()): string {
  return toDate(input).toISOString();
}
