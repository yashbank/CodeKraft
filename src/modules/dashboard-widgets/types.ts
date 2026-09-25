/**
 * Widget dashboard — docs/06 §2.7 API-ADM-13 `getDashboardLayout` / `saveDashboardLayout`,
 * API-ADM-14 `loadWidgetData`, docs/04 §7.6 (registry shape, 20 widgets), SCR-ADM-02
 * (react-grid-layout, 12 columns, row height 80 px), D-120, D-1101.
 */
import { z } from "zod";
import type { Permission } from "@/lib/authz/permissions";

/** The 20 widget keys (docs/06 API-ADM-14, docs/04 §7.6) — order = library order. */
export const WIDGET_KEYS = [
  "revenue_by_period",
  "revenue_by_product",
  "revenue_by_partner",
  "my_share",
  "outstanding_payouts",
  "expenses_vs_profit",
  "payments_awaiting",
  "publish_approvals",
  "split_approvals",
  "service_checklists_due",
  "revocation_tasks",
  "new_leads",
  "pipeline_funnel",
  "overdue_follow_ups",
  "conversion_rate",
  "open_queries",
  "visits_top_products",
  "chatbot_usage",
  "catalog_status_counts",
  "new_customers",
] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];
export const widgetKeySchema = z.enum(WIDGET_KEYS);

export const WIDGET_GROUPS = ["sales", "operations", "leads_queries", "traffic", "system"] as const;
export type WidgetGroup = (typeof WIDGET_GROUPS)[number];

export const GRID_COLUMNS = 12;
export const GRID_ROW_HEIGHT_PX = 80;
export const GRID_MAX_ROWS = 100;

export interface WidgetSize {
  w: number;
  h: number;
}

export const WIDGET_RANGES = ["7d", "30d", "90d", "fy"] as const;
export type WidgetRange = (typeof WIDGET_RANGES)[number];

/** API-ADM-14 `params`. */
export const widgetParamsSchema = z
  .object({
    range: z.enum(WIDGET_RANGES).optional(),
    currency: z.enum(["INR", "USD", "EUR", "GBP", "CAD"]).optional(),
    /** Queue/top-N widgets. */
    topN: z.number().int().min(1).max(20).optional(),
  })
  .strict();
export type WidgetParams = z.infer<typeof widgetParamsSchema>;

/** API-ADM-14 `loadWidgetData` — `dashboard.admin` + the widget's `requiredPermission`; cached 60 s per (user, key, params). */
export const loadWidgetDataSchema = z
  .object({ widgetKey: widgetKeySchema, params: widgetParamsSchema.optional() })
  .strict();
export type LoadWidgetDataInput = z.infer<typeof loadWidgetDataSchema>;

/** react-grid-layout item; `i` = widget key. Bounds: 12 columns, `x + w ≤ 12`, `h ≤ 100` rows. */
export const layoutItemSchema = z
  .object({
    i: widgetKeySchema,
    x: z
      .number()
      .int()
      .min(0)
      .max(GRID_COLUMNS - 1),
    y: z.number().int().min(0).max(GRID_MAX_ROWS),
    w: z.number().int().min(1).max(GRID_COLUMNS),
    h: z.number().int().min(1).max(GRID_MAX_ROWS),
    minW: z.number().int().min(1).max(GRID_COLUMNS).optional(),
    minH: z.number().int().min(1).max(GRID_MAX_ROWS).optional(),
    static: z.boolean().optional(),
  })
  .strict()
  .refine((it) => it.x + it.w <= GRID_COLUMNS, {
    message: `x + w must be ≤ ${GRID_COLUMNS}`,
    path: ["w"],
  });
export type LayoutItem = z.infer<typeof layoutItemSchema>;

/** API-ADM-13 `saveDashboardLayout` — unique keys, ≤ 20 items; unknown key → `VALIDATION`. */
export const saveDashboardLayoutSchema = z
  .object({
    layout: z
      .array(layoutItemSchema)
      .max(WIDGET_KEYS.length)
      .refine((items) => new Set(items.map((it) => it.i)).size === items.length, {
        message: "Each widget may appear once",
      }),
  })
  .strict();
export type SaveDashboardLayoutInput = z.infer<typeof saveDashboardLayoutSchema>;

/** API-ADM-13 `getDashboardLayout` takes no input. */
export const getDashboardLayoutSchema = z.object({}).strict();

/** Library card / `availableWidgets` entry (API-ADM-13 output) — everything but the loader. */
export interface WidgetMeta {
  key: WidgetKey;
  title: string;
  description: string;
  group: WidgetGroup;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  requiredPermission: Permission;
  /** `true` → auto-refresh every 60 s (operations queues); others refetch on focus. */
  autoRefresh: boolean;
  /** Honours the global range select. */
  timeRanged: boolean;
}

/** docs/04 §7.6 registry entry (`component` is the client half, registered in P7 `registry.tsx`). */
export interface WidgetDefinition<TData = unknown> extends WidgetMeta {
  loader: WidgetLoader<TData>;
}

export interface WidgetLoaderContext {
  userId: string;
  /** Admin-role partner scope (D-512): `my_share` shows own lines only; `revenue_by_partner` is super-admin only. */
  partnerId: string | null;
  isSuperAdmin: boolean;
  now: Date;
}

/** Server Action data loader: read-only, not audited, JSON result rendered client-side. */
export type WidgetLoader<TData = unknown> = (
  ctx: WidgetLoaderContext,
  params: WidgetParams,
) => Promise<TData>;

export interface DashboardLayoutResult {
  layout: LayoutItem[];
  availableWidgets: WidgetMeta[];
}

export interface WidgetDataResult<TData = unknown> {
  widgetKey: WidgetKey;
  data: TData;
  /** ISO time the data was computed (60 s cache). */
  computedAt: string;
}

const meta = (
  key: WidgetKey,
  title: string,
  group: WidgetGroup,
  requiredPermission: Permission,
  defaultSize: WidgetSize,
  minSize: WidgetSize,
  extra: Partial<Pick<WidgetMeta, "autoRefresh" | "timeRanged" | "description">> = {},
): WidgetMeta => ({
  key,
  title,
  description: extra.description ?? title,
  group,
  requiredPermission,
  defaultSize,
  minSize,
  autoRefresh: extra.autoRefresh ?? false,
  timeRanged: extra.timeRanged ?? false,
});

const STAT: WidgetSize = { w: 3, h: 2 };
const CHART: WidgetSize = { w: 6, h: 4 };
const QUEUE: WidgetSize = { w: 4, h: 4 };
const MIN_STAT: WidgetSize = { w: 2, h: 2 };
const MIN_CHART: WidgetSize = { w: 4, h: 3 };

/** Frozen metadata for the 20 widgets (SCR-ADM-02 groups; permission per docs/06 §1.2). */
export const WIDGET_CATALOG: Readonly<Record<WidgetKey, WidgetMeta>> = Object.freeze({
  revenue_by_period: meta(
    "revenue_by_period",
    "Revenue by period",
    "sales",
    "finance.reports.read",
    CHART,
    MIN_CHART,
    { timeRanged: true, description: "Line chart of paid revenue in INR" },
  ),
  revenue_by_product: meta(
    "revenue_by_product",
    "Revenue by product",
    "sales",
    "finance.reports.read",
    CHART,
    MIN_CHART,
    { timeRanged: true },
  ),
  revenue_by_partner: meta(
    "revenue_by_partner",
    "Revenue by partner",
    "sales",
    "finance.ledger.read_all",
    CHART,
    MIN_CHART,
    { timeRanged: true, description: "Super Admin only" },
  ),
  my_share: meta("my_share", "My share", "sales", "finance.ledger.read", STAT, MIN_STAT, {
    timeRanged: true,
    description: "Own partner share with sparkline",
  }),
  outstanding_payouts: meta(
    "outstanding_payouts",
    "Outstanding payouts",
    "sales",
    "finance.ledger.read",
    QUEUE,
    MIN_STAT,
  ),
  expenses_vs_profit: meta(
    "expenses_vs_profit",
    "Expenses vs profit",
    "sales",
    "finance.reports.read",
    CHART,
    MIN_CHART,
    { timeRanged: true },
  ),
  payments_awaiting: meta(
    "payments_awaiting",
    "Payments awaiting confirmation",
    "operations",
    "payments.confirm",
    QUEUE,
    MIN_STAT,
    { autoRefresh: true },
  ),
  publish_approvals: meta(
    "publish_approvals",
    "Publish approvals pending",
    "operations",
    "approvals.read",
    QUEUE,
    MIN_STAT,
    { autoRefresh: true },
  ),
  split_approvals: meta(
    "split_approvals",
    "Split approvals pending",
    "operations",
    "approvals.read",
    QUEUE,
    MIN_STAT,
    { autoRefresh: true },
  ),
  service_checklists_due: meta(
    "service_checklists_due",
    "Service checklists due",
    "operations",
    "delivery.tasks.write",
    QUEUE,
    MIN_STAT,
    { autoRefresh: true },
  ),
  revocation_tasks: meta(
    "revocation_tasks",
    "Revocation tasks",
    "operations",
    "delivery.tasks.write",
    QUEUE,
    MIN_STAT,
    { autoRefresh: true },
  ),
  new_leads: meta("new_leads", "New leads", "leads_queries", "leads.read", QUEUE, MIN_STAT, {
    autoRefresh: true,
    timeRanged: true,
  }),
  pipeline_funnel: meta(
    "pipeline_funnel",
    "Pipeline funnel",
    "leads_queries",
    "leads.read",
    CHART,
    MIN_CHART,
    { timeRanged: true },
  ),
  overdue_follow_ups: meta(
    "overdue_follow_ups",
    "Overdue follow-ups",
    "leads_queries",
    "leads.read",
    QUEUE,
    MIN_STAT,
    { autoRefresh: true },
  ),
  conversion_rate: meta(
    "conversion_rate",
    "Conversion rate",
    "leads_queries",
    "leads.read",
    STAT,
    MIN_STAT,
    { timeRanged: true },
  ),
  open_queries: meta(
    "open_queries",
    "Open queries",
    "leads_queries",
    "queries.read",
    QUEUE,
    MIN_STAT,
    { autoRefresh: true },
  ),
  visits_top_products: meta(
    "visits_top_products",
    "Visits & top products",
    "traffic",
    "analytics.read",
    CHART,
    MIN_CHART,
    { timeRanged: true },
  ),
  chatbot_usage: meta(
    "chatbot_usage",
    "Chatbot usage vs limits",
    "system",
    "analytics.read",
    STAT,
    MIN_STAT,
  ),
  catalog_status_counts: meta(
    "catalog_status_counts",
    "Catalog status counts",
    "system",
    "catalog.read",
    STAT,
    MIN_STAT,
  ),
  new_customers: meta(
    "new_customers",
    "New customers",
    "system",
    "customers.read",
    STAT,
    MIN_STAT,
    { timeRanged: true },
  ),
});

/** Default layout for a new admin (SCR-ADM-02). */
export const DEFAULT_WIDGET_KEYS = [
  "payments_awaiting",
  "publish_approvals",
  "new_leads",
  "open_queries",
  "revenue_by_period",
  "overdue_follow_ups",
] as const satisfies readonly WidgetKey[];
