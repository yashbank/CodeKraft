/**
 * Bulk row actions (P14-12a): run an existing single-item server action once per selected id.
 * Each call goes through that action's own permission check, so a forbidden id (or one the
 * caller's scope excludes) fails on its own without blocking the rest.
 */
export const BULK_MAX = 100;

type Settled = { ok: true } | { ok: false; error: { message: string } };

export interface BulkResult {
  done: string[];
  failed: Array<{ id: string; message: string }>;
}

export async function runBulk(
  ids: readonly string[],
  fn: (id: string) => Promise<Settled>,
): Promise<BulkResult> {
  const unique = [...new Set(ids)];
  if (unique.length > BULK_MAX) throw new Error(`Select at most ${BULK_MAX} items at a time.`);
  const out: BulkResult = { done: [], failed: [] };
  // Sequential on purpose: keeps audit order stable and avoids hammering the DB pool.
  for (const id of unique) {
    try {
      const r = await fn(id);
      if (r.ok) out.done.push(id);
      else out.failed.push({ id, message: r.error.message });
    } catch (err) {
      out.failed.push({ id, message: err instanceof Error ? err.message : "Failed" });
    }
  }
  return out;
}

/** One-line toast text: "Marked 3 orders failed" / "2 of 3 failed: <first reason>". */
export function bulkSummary(verb: string, noun: string, r: BulkResult): string {
  const total = r.done.length + r.failed.length;
  const plural = (n: number) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  if (r.failed.length === 0) return `${verb} ${plural(r.done.length)}`;
  return `${verb} ${r.done.length} of ${plural(total)}; ${r.failed.length} failed: ${r.failed[0]?.message}`;
}
