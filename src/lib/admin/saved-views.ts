/** Saved list filters: name + query string, kept in localStorage per admin user and screen. */
export interface SavedView {
  id: string;
  name: string;
  query: string;
}

type Store = Pick<Storage, "getItem" | "setItem">;
const key = (userId: string, screen: string) => `ck.views.${userId}.${screen}`;

export function listViews(store: Store, userId: string, screen: string): SavedView[] {
  try {
    const v: unknown = JSON.parse(store.getItem(key(userId, screen)) ?? "[]");
    return Array.isArray(v)
      ? v.filter(
          (x): x is SavedView =>
            typeof x?.id === "string" &&
            typeof x?.name === "string" &&
            typeof x?.query === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** Saving under an existing name replaces that view. */
export function saveView(
  store: Store,
  userId: string,
  screen: string,
  name: string,
  query: string,
): SavedView[] {
  const n = name.trim().slice(0, 60);
  if (!n) return listViews(store, userId, screen);
  const next = [
    ...listViews(store, userId, screen).filter((v) => v.name !== n),
    {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: n,
      query: query.replace(/^\?/, ""),
    },
  ];
  store.setItem(key(userId, screen), JSON.stringify(next));
  return next;
}

export function deleteView(store: Store, userId: string, screen: string, id: string): SavedView[] {
  const next = listViews(store, userId, screen).filter((v) => v.id !== id);
  store.setItem(key(userId, screen), JSON.stringify(next));
  return next;
}

/** Undo of `deleteView`: puts the removed view back (same id), unless the id is already there. */
export function restoreView(
  store: Store,
  userId: string,
  screen: string,
  v: SavedView,
): SavedView[] {
  const cur = listViews(store, userId, screen);
  if (cur.some((x) => x.id === v.id)) return cur;
  const next = [...cur, v];
  store.setItem(key(userId, screen), JSON.stringify(next));
  return next;
}
