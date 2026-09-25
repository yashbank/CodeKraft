import type { WidgetKey } from "../types";

export type WidgetGroup =
  | "Sales & revenue"
  | "Operations"
  | "Leads & queries"
  | "Traffic"
  | "Catalog & customers"
  | "System & AI";

export interface WidgetDefinition {
  key: WidgetKey;
  title: string;
  group: WidgetGroup;
  description: string;
  requiredPermission: string;
  /** Static 12-column grid span until react-grid-layout lands (Phase 8). */
  colSpan: 3 | 4 | 6 | 8 | 12;
  rowSpan?: 1 | 2;
  superAdminOnly?: boolean;
}

/** The 20-widget library (SCR-ADM-02, docs/04 §7.6) plus system health. */
export const WIDGET_LIBRARY: WidgetDefinition[] = [
  {
    key: "revenue_by_period",
    title: "Revenue by period",
    group: "Sales & revenue",
    description: "Net revenue per week or month for the selected range.",
    requiredPermission: "finance.reports.read",
    colSpan: 8,
  },
  {
    key: "revenue_by_product",
    title: "Revenue by product",
    group: "Sales & revenue",
    description: "Net revenue per product.",
    requiredPermission: "finance.reports.read",
    colSpan: 4,
  },
  {
    key: "revenue_by_partner",
    title: "Revenue by partner",
    group: "Sales & revenue",
    description: "Partner allocations; Super Admin only.",
    requiredPermission: "finance.ledger.read_all",
    colSpan: 4,
    superAdminOnly: true,
  },
  {
    key: "my_share",
    title: "My share",
    group: "Sales & revenue",
    description: "Your allocations in the range with a 8-week sparkline.",
    requiredPermission: "finance.ledger.read",
    colSpan: 4,
  },
  {
    key: "outstanding_payouts",
    title: "Outstanding payouts",
    group: "Sales & revenue",
    description: "Partner balances not yet paid out.",
    requiredPermission: "finance.payout.record",
    colSpan: 4,
  },
  {
    key: "expenses_vs_profit",
    title: "Expenses vs profit",
    group: "Sales & revenue",
    description: "Stacked monthly expenses and profit.",
    requiredPermission: "finance.reports.read",
    colSpan: 4,
  },
  {
    key: "payments_awaiting",
    title: "Payments awaiting confirmation",
    group: "Operations",
    description: "Submitted references waiting for a human check, with a Confirm shortcut.",
    requiredPermission: "payments.confirm",
    colSpan: 4,
  },
  {
    key: "publish_approvals",
    title: "Publish approvals pending",
    group: "Operations",
    description: "Products waiting for your publish decision.",
    requiredPermission: "approvals.decide",
    colSpan: 4,
  },
  {
    key: "split_approvals",
    title: "Split approvals pending",
    group: "Operations",
    description: "Project-order splits awaiting approval.",
    requiredPermission: "approvals.decide",
    colSpan: 4,
  },
  {
    key: "service_checklists",
    title: "Service checklists due",
    group: "Operations",
    description: "Open service deliveries with progress.",
    requiredPermission: "delivery.tasks.write",
    colSpan: 4,
  },
  {
    key: "revocation_tasks",
    title: "Revocation tasks",
    group: "Operations",
    description: "External accounts to disable after refunds/revocations.",
    requiredPermission: "delivery.tasks.write",
    colSpan: 4,
  },
  {
    key: "new_leads",
    title: "New leads",
    group: "Leads & queries",
    description: "Unassigned pool and the newest leads.",
    requiredPermission: "leads.read",
    colSpan: 4,
  },
  {
    key: "pipeline_funnel",
    title: "Pipeline funnel",
    group: "Leads & queries",
    description: "Leads per stage.",
    requiredPermission: "leads.read",
    colSpan: 4,
  },
  {
    key: "overdue_follow_ups",
    title: "Overdue follow-ups",
    group: "Leads & queries",
    description: "Leads whose follow-up date has passed.",
    requiredPermission: "leads.read",
    colSpan: 4,
  },
  {
    key: "conversion_rate",
    title: "Conversion rate",
    group: "Leads & queries",
    description: "Won ÷ closed leads in the range.",
    requiredPermission: "leads.read",
    colSpan: 3,
  },
  {
    key: "open_queries",
    title: "Open queries",
    group: "Leads & queries",
    description: "Oldest unanswered first.",
    requiredPermission: "queries.read",
    colSpan: 4,
  },
  {
    key: "visits_top_products",
    title: "Visits & top products",
    group: "Traffic",
    description: "Umami visits and the most-viewed products.",
    requiredPermission: "dashboard.admin",
    colSpan: 4,
  },
  {
    key: "chatbot_usage",
    title: "Chatbot usage vs limits",
    group: "System & AI",
    description: "Platform and per-user daily caps.",
    requiredPermission: "chat.transcripts.read",
    colSpan: 4,
  },
  {
    key: "catalog_status",
    title: "Catalog status counts",
    group: "Catalog & customers",
    description: "Products per status.",
    requiredPermission: "catalog.read",
    colSpan: 4,
  },
  {
    key: "new_customers",
    title: "New customers",
    group: "Catalog & customers",
    description: "Sign-ups in the range.",
    requiredPermission: "customers.read",
    colSpan: 3,
  },
  {
    key: "system_health",
    title: "System health",
    group: "System & AI",
    description: "Database, email, AI provider and cron status.",
    requiredPermission: "ops.read",
    colSpan: 4,
  },
];

/** Default layout for a new admin (SCR-ADM-02). */
export const DEFAULT_LAYOUT: WidgetKey[] = [
  "payments_awaiting",
  "publish_approvals",
  "new_leads",
  "open_queries",
  "revenue_by_period",
  "overdue_follow_ups",
];
