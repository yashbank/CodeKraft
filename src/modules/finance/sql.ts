/**
 * Small SQL/serialisation helpers shared by the finance service, queries, reports and reconcile.
 * Integer-only (no-float-money): aggregates come back from Postgres as strings and are narrowed
 * through `BigInt` → `toSafeNumber`, never `Number(...)`.
 */
import { IST_OFFSET_MINUTES, istParts, isoDate } from "@/lib/dates";
import { AppError, ErrorCode } from "@/lib/errors";
import { toSafeNumber } from "@/lib/money";

/** `bigint`/`numeric` aggregate → safe integer (`null` → 0). */
export function intFromSql(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return toSafeNumber(BigInt(value), "sql integer");
  if (typeof value === "bigint") return toSafeNumber(value, "sql integer");
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Postgres may render an exact integer numeric as "12.00"; strip a zero fraction only.
    const m = /^(-?\d+)(?:\.0+)?$/.exec(trimmed);
    if (m === null) throw new TypeError(`sql integer expected, got ${JSON.stringify(value)}`);
    return toSafeNumber(BigInt(m[1] as string), "sql integer");
  }
  throw new TypeError(`sql integer expected, got ${typeof value}`);
}

/** `date` column value as `YYYY-MM-DD` whether the driver gave a string or a `Date`. */
export function dateColumn(value: string | Date): string {
  return value instanceof Date ? isoDate(value, "UTC") : value;
}

/** `timestamptz` column value as a `Date` (drivers may hand back ISO strings). */
export function timestampColumn(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60_000;

/** Instant at which the IST calendar day `YYYY-MM-DD` begins. */
export function istDayStart(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (m === null) throw new AppError(ErrorCode.VALIDATION, `invalid date ${day}`);
  const [y, mo, d] = [m[1], m[2], m[3]].map((s) => Number.parseInt(s as string, 10));
  return new Date(Date.UTC(y as number, (mo as number) - 1, d as number) - IST_OFFSET_MS);
}

/** Exclusive end instant of the IST calendar day (start of the next day). */
export function istDayEnd(day: string): Date {
  return new Date(istDayStart(day).getTime() + 86_400_000);
}

/** Half-open `[from, to)` instant range for inclusive IST calendar dates. */
export function istRange(dateFrom: string, dateTo: string): { from: Date; to: Date } {
  return { from: istDayStart(dateFrom), to: istDayEnd(dateTo) };
}

/** Bucket key of an instant for report granularities, evaluated in IST. */
export function periodKey(at: Date, granularity: "day" | "month" | "fy"): string {
  const p = istParts(at);
  if (granularity === "day") return p.isoDate;
  if (granularity === "month") return `${String(p.year)}-${String(p.month).padStart(2, "0")}`;
  const start = p.month >= 4 ? p.year : p.year - 1;
  return `${String(start)}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------------------------
// Cursors (docs/06 §1.8): base64url of JSON `[sortValue, id]`
// ---------------------------------------------------------------------------------------------

export function encodeCursor(sortValue: string | number, id: string): string {
  return Buffer.from(JSON.stringify([sortValue, id]), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): { sortValue: string | number; id: string } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      (typeof parsed[0] === "string" || typeof parsed[0] === "number") &&
      typeof parsed[1] === "string"
    ) {
      return { sortValue: parsed[0], id: parsed[1] };
    }
  } catch {
    // fall through
  }
  throw new AppError(ErrorCode.VALIDATION, "invalid cursor", {
    fieldErrors: { cursor: ["invalid cursor"] },
  });
}

/** `'field:asc'` → `{ field, dir }`. */
export function parseSort<F extends string>(
  sort: `${F}:asc` | `${F}:desc` | undefined,
  fallback: F,
  fallbackDir: "asc" | "desc" = "desc",
): { field: F; dir: "asc" | "desc" } {
  if (sort === undefined) return { field: fallback, dir: fallbackDir };
  const idx = sort.lastIndexOf(":");
  return { field: sort.slice(0, idx) as F, dir: sort.slice(idx + 1) as "asc" | "desc" };
}
