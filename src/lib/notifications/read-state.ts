/** Single read/unread rule shared by the bell, badge and inbox screens (admin + account). */
type Readable = { id: string; read: boolean };

export const countUnread = (items: readonly Readable[]): number =>
  items.filter((n) => !n.read).length;

/** Marks `ids` read (all when omitted); returns new items. */
export function applyRead<T extends Readable>(items: readonly T[], ids?: ReadonlySet<string>): T[] {
  return items.map((n) => (!ids || ids.has(n.id) ? { ...n, read: true } : n));
}

type ClickLike = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  preventDefault: () => void;
};

/**
 * Click on a notification link: persist "read" BEFORE navigating. A fire-and-forget server action
 * races the navigation (the target page's layout can render before the UPDATE lands, so the item
 * comes back unread). Modified clicks (new tab) keep the browser default and just fire the write.
 */
export async function readThenOpen(
  e: ClickLike,
  markRead: () => Promise<unknown>,
  open: () => void,
): Promise<void> {
  if (e.defaultPrevented) return;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    void markRead().catch(() => undefined);
    return;
  }
  e.preventDefault();
  try {
    await markRead();
  } catch {
    // Still open the item; the next refresh shows the true state.
  }
  open();
}
