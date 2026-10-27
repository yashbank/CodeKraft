/**
 * Per-admin dashboard widget selection + order (R8-10, API-ADM-13 `dashboard_layouts`).
 *
 * The admin UI's widget library (`components/admin/dashboard/widget-library.ts`) is the set of
 * keys an admin can pick; this file keeps the persisted list of those keys so the module does not
 * import UI code. `tests/unit/dashboard-widgets/admin-layout.test.ts` pins the two lists together.
 *
 * Storage: one `dashboard_layouts` row per admin user (`user_id` PK). `layout` holds
 * react-grid-layout-shaped items `[{ i, x, y, w, h }]` in display order; only `i` + order are
 * read back today (the grid is static), so `x/y/w/h` are derived from the index on write.
 */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/lib/db";
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
] as const;
export type AdminWidgetKey = (typeof ADMIN_WIDGET_KEYS)[number];

const KNOWN = new Set<string>(ADMIN_WIDGET_KEYS);

export const saveAdminWidgetLayoutSchema = z
  .object({
    widgets: z
      .array(z.enum(ADMIN_WIDGET_KEYS))
      .max(ADMIN_WIDGET_KEYS.length)
      .refine((keys) => new Set(keys).size === keys.length, {
        message: "Each widget may appear once",
      }),
  })
  .strict();
export type SaveAdminWidgetLayoutInput = z.infer<typeof saveAdminWidgetLayoutSchema>;

/**
 * Reads a stored `layout` jsonb value back into an ordered key list. Accepts both the item shape
 * (`[{ i: "new_leads", ... }]`) and a bare string array; unknown keys (a widget removed from the
 * library) and duplicates are dropped. Returns `null` when the value is not an array at all.
 */
export function parseStoredWidgetLayout(raw: unknown): AdminWidgetKey[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AdminWidgetKey[] = [];
  for (const entry of raw) {
    const key =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object" && typeof (entry as { i?: unknown }).i === "string"
          ? (entry as { i: string }).i
          : null;
    if (key && KNOWN.has(key) && !out.includes(key as AdminWidgetKey)) {
      out.push(key as AdminWidgetKey);
    }
  }
  return out;
}

/** Ordered keys -> stored items (single column, one row per widget, in display order). */
export function toStoredWidgetLayout(keys: readonly AdminWidgetKey[]) {
  return keys.map((i, index) => ({ i, x: 0, y: index, w: 12, h: 1 }));
}

async function resolveDb(db?: DbOrTx): Promise<DbOrTx> {
  if (db) return db;
  const mod = await import("@/lib/db");
  return mod.db;
}

/** The admin's saved widget keys, or `null` when they never saved one (use the default layout). */
export async function getAdminWidgetLayout(
  userId: string,
  db?: DbOrTx,
): Promise<AdminWidgetKey[] | null> {
  const conn = await resolveDb(db);
  const [row] = await conn
    .select({ layout: dashboardLayouts.layout })
    .from(dashboardLayouts)
    .where(eq(dashboardLayouts.userId, userId))
    .limit(1);
  return row ? parseStoredWidgetLayout(row.layout) : null;
}

/** Upserts the admin's own row — layouts are never shared between admins. */
export async function saveAdminWidgetLayout(
  userId: string,
  keys: readonly AdminWidgetKey[],
  db?: DbOrTx,
): Promise<AdminWidgetKey[]> {
  const conn = await resolveDb(db);
  const layout = toStoredWidgetLayout(keys);
  await conn
    .insert(dashboardLayouts)
    .values({ userId, layout })
    .onConflictDoUpdate({
      target: dashboardLayouts.userId,
      set: { layout, updatedAt: sql`now()` },
    });
  return [...keys];
}
