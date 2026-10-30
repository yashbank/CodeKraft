import type { DashboardData, WidgetKey } from "../types";

/** Which `DashboardData` slices each widget renders (every selectable widget has a data source). */
export const WIDGET_DATA_KEYS: Record<WidgetKey, ReadonlyArray<keyof DashboardData>> = {
  revenue_by_period: ["revenueByPeriod"],
  revenue_by_product: ["revenueByProduct"],
  revenue_by_partner: ["revenueByPartner"],
  my_share: ["myShare"],
  outstanding_payouts: ["outstandingPayouts"],
  expenses_vs_profit: ["expensesVsProfit"],
  payments_awaiting: ["paymentsAwaiting"],
  publish_approvals: ["publishApprovals"],
  split_approvals: ["splitApprovals"],
  service_checklists: ["serviceChecklists"],
  revocation_tasks: ["revocationTasks"],
  new_leads: ["newLeads"],
  pipeline_funnel: ["funnel"],
  overdue_follow_ups: ["overdueFollowUps"],
  conversion_rate: ["conversionRate"],
  open_queries: ["openQueries"],
  visits_top_products: ["visits"],
  chatbot_usage: ["chatbotUsage"],
  catalog_status: ["catalogStatus"],
  new_customers: ["newCustomers"],
  system_health: ["systemHealth", "visits"],
  orders_heatmap: ["ordersHeatmap"],
};

/** The slice of `DashboardData` a single widget renders. */
export function pickWidgetData(widget: WidgetKey, data: DashboardData): Partial<DashboardData> {
  const out: Partial<DashboardData> = {};
  for (const key of WIDGET_DATA_KEYS[widget]) {
    (out as Record<string, unknown>)[key] = data[key];
  }
  return out;
}
