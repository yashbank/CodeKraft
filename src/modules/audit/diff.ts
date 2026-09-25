/**
 * Audit diff builder (docs/06 §1.6, PHASE-03 P3.1).
 * Computes changed keys only between `before` and `after` states.
 */

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function areEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface DiffResult {
  before: unknown;
  after: unknown;
}

/**
 * Builds a diff containing only the changed keys.
 * If before and after are identical, returns null.
 * If both are objects, returns objects with only differing keys.
 */
export function buildDiff(before: unknown, after: unknown): DiffResult | null {
  if (before === undefined && after === undefined) return null;
  if (areEqual(before, after)) return null;

  if (isPlainObject(before) && isPlainObject(after)) {
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const diffBefore: Record<string, unknown> = {};
    const diffAfter: Record<string, unknown> = {};
    let changed = false;

    for (const key of allKeys) {
      const valBefore = before[key];
      const valAfter = after[key];

      if (!areEqual(valBefore, valAfter)) {
        changed = true;
        if (key in before) diffBefore[key] = valBefore;
        if (key in after) diffAfter[key] = valAfter;
      }
    }

    if (!changed) return null;
    return { before: diffBefore, after: diffAfter };
  }

  // Primitive, array, or one is null/undefined
  return { before: before ?? null, after: after ?? null };
}
