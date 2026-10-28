/**
 * Server-only loader for every dashboard widget's data. Used by the dashboard page (all widgets)
 * and by the per-widget refresh server action (`refreshDashboardWidget`), so the two can never
 * drift. Every `WidgetKey` has an entry in `WIDGET_DATA_KEYS` naming the `DashboardData` slices it
 * renders (pinned by tests/unit/admin/dashboard-widgets-data-sources.test.ts).
 */
import { can } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import type { DashboardData, ProductStatus, QueueItem, WidgetKey } from "@/components/admin/types";
import { WIDGET_LIBRARY } from "@/components/admin/dashboard/widget-library";
export { WIDGET_DATA_KEYS, pickWidgetData } from "@/components/admin/dashboard/widget-data-keys";
import { startOfFy } from "@/lib/dates";
import { listApprovalsAction } from "@/modules/approvals/queries";
import { listQueriesAdminQuery } from "@/modules/queries/queries";
import { listLeadsQuery } from "@/modules/leads/queries";
import { listProductsAdminQuery } from "@/modules/catalog/queries";
import { getReportQuery } from "@/modules/finance/queries";
import { lastDaysRange, mapRevenueByPeriod } from "./dashboard-view";
import { loadDashboardFinance } from "./dashboard-finance";
import {
  RANGE_DAYS,
  deltaText,
  loadChatbotUsage,
  loadConversionRate,
  loadFunnel,
  loadNewCustomers,
  loadRevocationTasks,
  loadServiceChecklists,
  loadSystemHealth,
  loadVisits,
} from "./dashboard-widgets-data";

export type DashboardRange = DashboardData["range"];
export const DASHBOARD_RANGES = ["7d", "30d", "90d", "fy"] as const;

export function rangeDates(range: DashboardRange, now = new Date()) {
  if (range === "fy") {
    return {
      dateFrom: startOfFy(now).toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
    };
  }
  return lastDaysRange(range === "7d" ? 7 : range === "90d" ? 90 : 30, now);
}

function approvalItem(a: { payloadSummary: string; ageHours: number }): QueueItem {
  return {
    label: a.payloadSummary,
    meta: `requested ${Math.round(a.ageHours)}h ago`,
    href: "/approvals",
  };
}

export async function loadDashboardData(
  ctx: RequestContext,
  range: DashboardRange,
): Promise<DashboardData> {
  const days = RANGE_DAYS[range];
  const allowed = (key: WidgetKey) => {
    const def = WIDGET_LIBRARY.find((w) => w.key === key);
    return !def || can(ctx, def.requiredPermission as Parameters<typeof can>[1]);
  };

  const [
    publishRes,
    splitRes,
    queriesRes,
    leadsRes,
    productsRes,
    revenueRes,
    finance,
    serviceChecklists,
    revocationTasks,
    funnel,
    conversionRate,
    visits,
    chatbotUsage,
    newCustomers,
    systemHealth,
  ] = await Promise.all([
    listApprovalsAction({ type: "product.publish", status: "pending", limit: 10 }, ctx),
    listApprovalsAction({ type: "project_order.split", status: "pending", limit: 10 }, ctx),
    listQueriesAdminQuery({ limit: 100, filters: { status: ["open"] } }, ctx),
    listLeadsQuery({ limit: 100 }, ctx),
    listProductsAdminQuery({ limit: 100 }, ctx),
    getReportQuery({ report: "revenue_by_period", ...rangeDates(range) }, ctx).catch(() => ({
      ok: false as const,
    })),
    loadDashboardFinance(ctx, rangeDates(range)).catch((err: unknown) => {
      console.error("[dashboard] finance widgets failed", err);
      return null;
    }),
    allowed("service_checklists") ? loadServiceChecklists() : Promise.resolve([]),
    allowed("revocation_tasks") ? loadRevocationTasks() : Promise.resolve([]),
    allowed("pipeline_funnel") ? loadFunnel() : Promise.resolve([]),
    allowed("conversion_rate")
      ? loadConversionRate(days)
      : Promise.resolve({ value: 0, delta: "No data yet" }),
    allowed("visits_top_products")
      ? loadVisits(days)
      : Promise.resolve({ total: 0, delta: "No data yet", top: [] }),
    allowed("chatbot_usage")
      ? loadChatbotUsage()
      : Promise.resolve({ platform: 0, platformCap: 0, usersAtCap: 0, perUserCap: 0 }),
    allowed("new_customers")
      ? loadNewCustomers(days)
      : Promise.resolve({ count: 0, delta: "No data yet", sparkline: [] as number[] }),
    allowed("system_health") ? loadSystemHealth() : Promise.resolve([]),
  ]);

  const money = finance ?? {
    revenueByProduct: [],
    revenueByPartner: [],
    myShare: { valueInr: 0, delta: "Couldn't load", sparkline: [] },
    outstandingPayouts: { totalInr: 0, items: [] },
    expensesVsProfit: [],
    paymentsAwaiting: [],
  };

  const leads = leadsRes.ok ? leadsRes.data.items : [];
  const newLeadItems = leads.filter((l) => l.status === "new");
  const overdueLeadItems = leads.filter((l) => l.overdue);

  const statusCounts = new Map<ProductStatus, number>();
  for (const p of productsRes.ok ? productsRes.data.items : [])
    statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);

  return {
    range,
    revenueByPeriod:
      "data" in revenueRes && revenueRes.ok
        ? mapRevenueByPeriod(revenueRes.data.rows as Array<Record<string, unknown>>)
        : [],
    ...money,
    publishApprovals: publishRes.ok ? publishRes.data.items.map(approvalItem) : [],
    splitApprovals: splitRes.ok ? splitRes.data.items.map(approvalItem) : [],
    serviceChecklists,
    revocationTasks,
    newLeads: {
      count: newLeadItems.length,
      delta: newLeadItems.length === 0 ? "No data yet" : deltaText(newLeadItems.length, 0),
      items: newLeadItems.slice(0, 5).map((l) => ({
        label: l.name,
        meta: l.company ?? l.email ?? undefined,
        href: `/leads/${l.leadId}`,
      })),
    },
    funnel,
    overdueFollowUps: overdueLeadItems.slice(0, 5).map((l) => ({
      label: l.name,
      meta: l.company ?? l.email ?? undefined,
      href: `/leads/${l.leadId}`,
      tone: "warning" as const,
    })),
    conversionRate,
    openQueries: queriesRes.ok
      ? queriesRes.data.items.slice(0, 10).map((q) => ({
          label: q.subject,
          meta: q.customer.name ?? q.customer.email,
          href: `/queries/${q.queryId}`,
        }))
      : [],
    visits,
    chatbotUsage,
    catalogStatus: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
    newCustomers,
    systemHealth,
  };
}
