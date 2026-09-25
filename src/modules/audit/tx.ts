/**
 * Transaction helper shared by the P3 modules: run `fn` inside `dbOrTx` when it already is a
 * transaction, open one on the root client otherwise. `withTx` (src/lib/db.ts) joins an outer
 * transaction but cannot tell a root client from a transaction, which the `tx?: DbOrTx`
 * contract parameters need.
 */
import { type DbOrTx, type TxCtx, withTx } from "@/lib/db";

/** A drizzle `PgTransaction` exposes `rollback`; the root client does not. */
export function isTx(handle: DbOrTx | undefined): handle is TxCtx {
  return handle !== undefined && typeof (handle as { rollback?: unknown }).rollback === "function";
}

export async function runInTx<T>(
  handle: DbOrTx | undefined,
  fn: (tx: TxCtx) => Promise<T>,
): Promise<T> {
  if (isTx(handle)) return fn(handle);
  if (handle === undefined) return withTx(fn);
  return handle.transaction((tx) => fn(tx));
}

/** Read-only helper: use the handle as given (no transaction needed for a single SELECT). */
export function reader(handle: DbOrTx | undefined, fallback: () => DbOrTx): DbOrTx {
  return handle ?? fallback();
}
