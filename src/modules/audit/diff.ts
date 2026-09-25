/**
 * Diff builder for audit rows (PHASE-03 P3.1): only the top-level keys whose value changed are
 * kept in `before` / `after`, so a row shows what an action touched without a full snapshot.
 * Values are compared structurally after normalisation (Dates by instant, undefined = absent).
 */
import { redact } from "./redact";

export interface AuditDiff {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** Keys that differ, sorted. */
  changed: string[];
}

function normalise(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const member = normalise((value as Record<string, unknown>)[key]);
      if (member !== undefined) out[key] = member;
    }
    return out;
  }
  return value;
}

/** Structural equality on the normalised forms (order-insensitive for object keys). */
export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * `diff(before, after)`: for two records, keep only changed keys (redacted). A `null`/absent
 * side (create / delete) keeps the other side in full. Non-record values are stored as given.
 */
export function diff(before: unknown, after: unknown): AuditDiff {
  if (!isRecord(before) || !isRecord(after)) {
    const b = before === undefined || before === null ? null : (redact(before) as Record<string, unknown>);
    const a = after === undefined || after === null ? null : (redact(after) as Record<string, unknown>);
    const changed = deepEqual(before ?? null, after ?? null) ? [] : ["*"];
    return { before: isRecord(b) ? b : b === null ? null : { value: b }, after: isRecord(a) ? a : a === null ? null : { value: a }, changed };
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Array.from(keys).sort()) {
    if (deepEqual(before[key], after[key])) continue;
    changed.push(key);
    if (before[key] !== undefined) b[key] = before[key];
    if (after[key] !== undefined) a[key] = after[key];
  }
  return {
    before: redact(b) as Record<string, unknown>,
    after: redact(a) as Record<string, unknown>,
    changed,
  };
}
