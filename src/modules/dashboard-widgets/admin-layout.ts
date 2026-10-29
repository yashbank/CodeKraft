/**
 * Per-admin dashboard widget selection + order (R8-10, API-ADM-13 `dashboard_layouts`).
 *
 * The admin UI's widget library (`components/admin/dashboard/widget-library.ts`) is the set of
 * keys an admin can pick; this file keeps the persisted list of those keys so the module does not
 * import UI code. `tests/unit/dashboard-widgets/admin-layout.test.ts` pins the two lists together.
 *
 * Storage: one `dashboard_layouts` row per admin user (`user_id` PK). `layout` holds
 * react-grid-layout-shaped items `[{ i, x, y, w, h, style? }]` in display order; only `i`, `style`
 * and order are read back today (the grid is static), so `x/y/w/h` are derived from the index.
 */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/lib/db";
import { isWidgetStyle } from "./widget-styles";
import { dashboardLayouts } from "../../../drizzle/schema/ops";

export const ADMIN_WIDGET_KEYS = [
  "revenue_by_period",
  "revenue_by_product",
  "revenue_by_partner",
  "my_share",
  "outstanding_payouts",
  "expenses_vs_profit",
  "payments_awaiting",
  "publish_approvals",
  "split_approvals",
  "service_checklists",
  "revocation_tasks",
  "new_leads",
  "pipeline_funnel",
  "overdue_follow_ups",
  "conversion_rate",
  "open_queries",
  "visits_top_products",
  "chatbot_usage",
  "catalog_status",
  "new_customers",
  "system_health",
  "orders_heatmap",
] as const;
export type AdminWidgetKey = (typeof ADMIN_WIDGET_KEYS)[number];

const KNOWN = new Set<string>(ADMIN_WIDGET_KEYS);

/** A widget in display order, with its optional visual style (P14-09). */
export interface WidgetEntry {
  key: AdminWidgetKey;
  style?: string;
}

const widgetInput = z.union([
  z.enum(ADMIN_WIDGET_KEYS),
  z.object({ id: z.enum(ADMIN_WIDGET_KEYS), style: z.string().max(32).optional() }).strict(),
]);

export const saveAdminWidgetLayoutSchema = z
  .object({
    widgets: z
      .array(widgetInput)
      .max(ADMIN_WIDGET_KEYS.length)
      .transform((items): WidgetEntry[] =>
        items.map((w) => (typeof w === "string" ? { key: w } : { key: w.id, style: w.style })),
      )
      .refine((es) => new Set(es.map((e) => e.key)).size === es.length, {
        message: "Each widget may appear once",
      })
      .refine((es) => es.every((e) => e.style === undefined || isWidgetStyle(e.key, e.style)), {
        message: "Unknown style for this widget",
      }),
  })
  .strict();
export type SaveAdminWidgetLayoutInput = z.infer<typeof saveAdminWidgetLayoutSchema>;

/**
 * Reads a stored `layout` jsonb value back into ordered entries. Accepts the item shape
 * (`[{ i: "new_leads", style?, ... }]`), `{ id, style? }`, and a bare string array (the original
 * format); unknown keys (a widget removed from the library) and duplicates are dropped, an
 * unknown style is ignored (default look). Returns `null` when the value is not an array at all.
 */
export function parseStoredWidgetEntries(raw: unknown): WidgetEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: WidgetEntry[] = [];
  for (const entry of raw) {
    const obj = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
    const key = typeof entry === "string" ? entry : (obj?.i ?? obj?.id);
    if (typeof key !== "string" || !KNOWN.has(key) || out.some((e) => e.key === key)) continue;
    const k = key as AdminWidgetKey;
    out.push(isWidgetStyle(k, obj?.style) ? { key: k, style: obj?.style as string } : { key: k });
  }
  return out;
}

/** Same as {@link parseStoredWidgetEntries}, keys only. */
export function parseStoredWidgetLayout(raw: unknown): AdminWidgetKey[] | null {
  return parseStoredWidgetEntries(raw)?.map((e) => e.key) ?? null;
}

/** Ordered keys/entries -> stored items (single column, one row per widget, in display order). */
export function toStoredWidgetLayout(items: ReadonlyArray<AdminWidgetKey | WidgetEntry>) {
  return items.map((it, index) => {
    const { key, style } = typeof it === "string" ? { key: it, style: undefined } : it;
    return { i: key, x: 0, y: index, w: 12, h: 1, ...(style ? { style } : {}) };
  });
}

async function resolveDb(db?: DbOrTx): Promise<DbOrTx> {
  if (db) return db;
  const mod = await import("@/lib/db");
  return mod.db;
}

/** The admin's saved widgets + styles, or `null` when they never saved one (use the default layout). */
export async function getAdminWidgetEntries(
  userId: string,
  db?: DbOrTx,
): Promise<WidgetEntry[] | null> {
  const conn = await resolveDb(db);
  const [row] = await conn
    .select({ layout: dashboardLayouts.layout })
    .from(dashboardLayouts)
    .where(eq(dashboardLayouts.userId, userId))
    .limit(1);
  return row ? parseStoredWidgetEntries(row.layout) : null;
}

/** Keys only; `null` when they never saved a layout. */
export async function getAdminWidgetLayout(
  userId: string,
  db?: DbOrTx,
): Promise<AdminWidgetKey[] | null> {
  return (await getAdminWidgetEntries(userId, db))?.map((e) => e.key) ?? null;
}

/** Upserts the admin's own row — layouts are never shared between admins. */
export async function saveAdminWidgetLayout(
  userId: string,
  items: ReadonlyArray<AdminWidgetKey | WidgetEntry>,
  db?: DbOrTx,
): Promise<AdminWidgetKey[]> {
  const conn = await resolveDb(db);
  const layout = toStoredWidgetLayout(items);
  await conn
    .insert(dashboardLayouts)
    .values({ userId, layout })
    .onConflictDoUpdate({
      target: dashboardLayouts.userId,
      set: { layout, updatedAt: sql`now()` },
    });
  return items.map((it) => (typeof it === "string" ? it : it.key));
}
