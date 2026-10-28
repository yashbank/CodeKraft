/** Single read/unread rule shared by the bell, badge and inbox screens (admin + account). */
type Readable = { id: string; read: boolean };

export const countUnread = (items: readonly Readable[]): number =>
  items.filter((n) => !n.read).length;

/** Marks `ids` read (all when omitted); returns new items. */
export function applyRead<T extends Readable>(items: readonly T[], ids?: ReadonlySet<string>): T[] {
  return items.map((n) => (!ids || ids.has(n.id) ? { ...n, read: true } : n));
}
