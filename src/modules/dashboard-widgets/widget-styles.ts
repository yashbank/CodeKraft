/**
 * Visual styles per dashboard widget kind (P14-09). Pure data so the server (layout validation)
 * and the UI renderers share one list; the first style of each kind is its default. Every style
 * changes presentation only: numbers, labels and the text alternative are always rendered.
 * `tests/unit/dashboard-widgets/widget-styles.test.tsx` pins 5-6 styles per kind.
 *
 * Heatmap (weekday x hour grid) was added by P14-12a.
 */
import type { AdminWidgetKey } from "./admin-layout";

export const WIDGET_STYLES = {
  stat: ["plain", "accent-bar", "trend-badge", "big-number", "outlined", "tinted"],
  bar: ["filled", "outlined", "minimal", "gradient", "compact", "striped"],
  line: ["area", "line", "minimal", "gradient", "compact", "dots"],
  donut: ["donut", "pie", "thin-ring", "segmented", "center-total", "compact"],
  progress: ["solid", "thin", "thick", "segmented", "striped", "outlined"],
  sparkline: ["line", "area", "bars", "dots", "gradient", "minimal"],
  heatmap: ["squares", "rounded", "circles", "outlined", "contrast", "compact"],
  list: ["divided", "plain", "striped", "compact", "cards", "accent-bar"],
} as const;
export type WidgetKind = keyof typeof WIDGET_STYLES;

export const WIDGET_KIND: Record<AdminWidgetKey, WidgetKind> = {
  revenue_by_period: "line",
  revenue_by_product: "bar",
  revenue_by_partner: "bar",
  my_share: "sparkline",
  outstanding_payouts: "stat",
  expenses_vs_profit: "bar",
  payments_awaiting: "list",
  publish_approvals: "list",
  split_approvals: "list",
  service_checklists: "list",
  revocation_tasks: "list",
  new_leads: "stat",
  pipeline_funnel: "bar",
  overdue_follow_ups: "list",
  conversion_rate: "stat",
  open_queries: "list",
  visits_top_products: "stat",
  chatbot_usage: "progress",
  catalog_status: "donut",
  new_customers: "sparkline",
  system_health: "list",
  orders_heatmap: "heatmap",
};

export const stylesFor = (key: AdminWidgetKey): readonly string[] =>
  WIDGET_STYLES[WIDGET_KIND[key]];

export const isWidgetStyle = (key: AdminWidgetKey, style: unknown): style is string =>
  typeof style === "string" && stylesFor(key).includes(style);

/** The picked style when valid for the widget, else the kind's default. */
export const resolveWidgetStyle = (key: AdminWidgetKey, style: unknown): string =>
  isWidgetStyle(key, style) ? style : (stylesFor(key)[0] as string);
