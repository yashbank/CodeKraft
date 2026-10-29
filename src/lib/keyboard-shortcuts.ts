/** Real shortcuts only: each entry is wired in code (AdminShell, ui/sidebar, Radix dialogs). */
export interface ShortcutRow {
  keys: string[];
  label: string;
}

export const ADMIN_SHORTCUTS: ShortcutRow[] = [
  { keys: ["⌘/Ctrl", "K"], label: "Open search and quick actions" },
  { keys: ["/"], label: "Open search (when not typing in a field)" },
  { keys: ["⌘/Ctrl", "B"], label: "Collapse or expand the sidebar" },
  { keys: ["?"], label: "Show this list" },
  { keys: ["Esc"], label: "Close a dialog, menu or sheet" },
];

export const ACCOUNT_SHORTCUTS: ShortcutRow[] = [
  { keys: ["?"], label: "Show this list" },
  { keys: ["Esc"], label: "Close a dialog, menu or sheet" },
];

/** "?" anywhere except while typing in a field. */
export function isShortcutsKey(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey?: boolean;
  target: EventTarget | null;
}): boolean {
  if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return false;
  const el = e.target as HTMLElement | null;
  return !(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}
