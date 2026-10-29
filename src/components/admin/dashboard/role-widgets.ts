import type { WidgetKey } from "../types";
import { DEFAULT_LAYOUT, WIDGET_LIBRARY } from "./widget-library";

/**
 * Which widgets each role may put on its dashboard (P14-01). Pure data, shared by the server
 * (layout read/save, data loader, refresh action) and the Customise library. `super_admin` gets
 * the whole library; every key listed for the other roles shows that user's own, already-scoped
 * numbers (D-512: own products / own partner share / assigned-or-pool leads), so adding a widget
 * here means its loader must be scoped too.
 */
export const ROLE_WIDGETS: Readonly<Record<string, readonly WidgetKey[] | "all">> = {
  super_admin: "all",
  admin: [
    "my_share",
    "publish_approvals",
    "split_approvals",
    "new_leads",
    "overdue_follow_ups",
    "open_queries",
    "catalog_status",
  ],
  staff: ["new_leads", "overdue_follow_ups", "open_queries", "service_checklists"],
};

/** Library order, filtered to what the (union of) roles may use. Unknown roles get nothing. */
export function allowedWidgetKeys(roles: readonly string[]): WidgetKey[] {
  const grants = roles.map((r) => ROLE_WIDGETS[r]);
  const all = grants.includes("all");
  return WIDGET_LIBRARY.filter(
    (w) => all || grants.some((g) => Array.isArray(g) && g.includes(w.key)),
  ).map((w) => w.key);
}

/** Drops keys the roles may not use (e.g. from a stale saved layout), keeping order. */
export function permitWidgets(keys: readonly WidgetKey[], roles: readonly string[]): WidgetKey[] {
  const allowed = new Set(allowedWidgetKeys(roles));
  return keys.filter((k) => allowed.has(k));
}

/** The new-admin layout, narrowed to an allow-list (falls back to its first six widgets). */
export function defaultLayoutFor(allowed: readonly WidgetKey[]): WidgetKey[] {
  const def = DEFAULT_LAYOUT.filter((k) => allowed.includes(k));
  return def.length > 0 ? def : allowed.slice(0, 6);
}
