/** Moves `from` so it sits where `to` is (drag-and-drop). Unknown keys or from === to: unchanged. */
export function moveKey<T>(order: readonly T[], from: T, to: T): T[] {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0 || a === b) return [...order];
  const next = [...order];
  next.splice(a, 1);
  next.splice(b, 0, from);
  return next;
}
