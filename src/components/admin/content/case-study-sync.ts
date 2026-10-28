/** After router.refresh() the server list is the truth: re-point the open editor at its fresh row. */
export function resolveEditing<T extends { id: string; slug: string }>(
  fresh: T[],
  current: { id: string } | null,
  savedSlug: string | null,
): T | null {
  if (current) return fresh.find((c) => c.id === current.id) ?? null;
  return savedSlug ? (fresh.find((c) => c.slug === savedSlug) ?? null) : null;
}
