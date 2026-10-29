/**
 * Optimistic list rows for admin create flows (P14-02): a pending row shows the moment the form is
 * submitted, is re-keyed to the server id once the action returns, and is dropped on failure.
 * `mergeOptimistic` hides a pending row as soon as the refreshed server list contains its id, so the
 * row never doubles up between "action finished" and "page data refreshed".
 */
export const TEMP_ID_PREFIX = "optimistic-";

export const isTempId = (id: string): boolean => id.startsWith(TEMP_ID_PREFIX);

export type OptimisticAction<T extends { id: string }> =
  | { type: "add"; row: T }
  /** Action succeeded: swap the temp id for the server id (and any server-provided fields). */
  | { type: "settle"; tempId: string; id: string; patch?: Partial<T> }
  /** Action failed: remove the temp row. */
  | { type: "rollback"; tempId: string };

export function optimisticReducer<T extends { id: string }>(
  rows: readonly T[],
  action: OptimisticAction<T>,
): T[] {
  switch (action.type) {
    case "add":
      return [action.row, ...rows];
    case "settle":
      return rows.map((r) =>
        r.id === action.tempId ? { ...r, ...action.patch, id: action.id } : r,
      );
    case "rollback":
      return rows.filter((r) => r.id !== action.tempId);
  }
}

/** Pending rows the server list does not contain yet, newest first, then the server rows. */
export function mergeOptimistic<T extends { id: string }>(
  server: readonly T[],
  pending: readonly T[],
): T[] {
  const have = new Set(server.map((r) => r.id));
  return [...pending.filter((r) => !have.has(r.id)), ...server];
}
