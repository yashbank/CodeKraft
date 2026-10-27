import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { getSession } from "@/modules/auth/service";
import { lastDaysRange, mapRevenueByPeriod } from "@/lib/admin/dashboard-view";
import { loadDashboardFinance } from "@/lib/admin/dashboard-finance";
import { getReportQuery } from "@/modules/finance/queries";
import { listApprovalsAction } from "@/modules/approvals/queries";
import { listQueriesAdminQuery } from "@/modules/queries/queries";
import { listLeadsQuery } from "@/modules/leads/queries";
import { listCustomersQuery } from "@/modules/users/queries";
import { listProductsAdminQuery } from "@/modules/catalog/queries";
import type { DashboardData, QueueItem } from "@/components/admin/types";
import type { ProductStatus } from "@/components/admin/types";
import { fyFor, startOfFy } from "@/lib/dates";
import { getAdminWidgetLayout } from "@/modules/dashboard-widgets/admin-layout";

export const dynamic = "force-dynamic";

function approvalItem(a: {
  id: string;
  payloadSummary: string;
  requestedBy: string;
  ageHours: number;
}): QueueItem {
  return {
    label: a.payloadSummary,
    meta: `requested ${Math.round(a.ageHours)}h ago`,
    href: "/approvals",
  };
}

const RANGES = ["7d", "30d", "90d", "fy"] as const;
type Range = (typeof RANGES)[number];

function rangeDates(range: Range, now = new Date()) {
  if (range === "fy") {
    return {
      dateFrom: startOfFy(now).toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
    };
  }
  return lastDaysRange(range === "7d" ? 7 : range === "90d" ? 90 : 30, now);
}

export default async function AdminDashboardRoute({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const [ctx, session, sp] = await Promise.all([
    getAdminRequestContext(),
    getSession(),
    searchParams,
  ]);
  const range: Range = (RANGES as readonly string[]).includes(sp.range ?? "")
    ? (sp.range as Range)
    : "30d";
  const isSuperAdmin = ctx.roles.includes("super_admin");
  const firstName = session?.user.name?.split(" ")[0] || "there";
  // R8-10 — the admin's own saved widget selection/order (null → default layout).
  const savedLayout = await getAdminWidgetLayout(ctx.userId).catch(() => null);

  const [publishRes, splitRes, queriesRes, leadsRes, customersRes, productsRes, revenueRes] =
    await Promise.all([
      listApprovalsAction({ type: "product.publish", status: "pending", limit: 10 }, ctx),
      listApprovalsAction({ type: "project_order.split", status: "pending", limit: 10 }, ctx),
      listQueriesAdminQuery({ limit: 100, filters: { status: ["open"] } }, ctx),
      listLeadsQuery({ limit: 100 }, ctx),
      listCustomersQuery({ limit: 100 }, ctx),
      listProductsAdminQuery({ limit: 100 }, ctx),
      getReportQuery({ report: "revenue_by_period", ...rangeDates(range) }, ctx).catch(() => ({
        ok: false as const,
      })),
    ]);

  const finance = (await loadDashboardFinance(ctx).catch((err: unknown) => {
    console.error("[dashboard] finance widgets failed", err);
    return null;
  })) ?? {
    revenueByProduct: [],
    revenueByPartner: [],
    myShare: { valueInr: 0, delta: "Couldn't load", sparkline: [] },
    outstandingPayouts: { totalInr: 0, items: [] },
    expensesVsProfit: [],
    paymentsAwaiting: [],
  };

  const publishApprovals = publishRes.ok ? publishRes.data.items.map(approvalItem) : [];
  const splitApprovals = splitRes.ok ? splitRes.data.items.map(approvalItem) : [];

  const openQueries: QueueItem[] = queriesRes.ok
    ? queriesRes.data.items.slice(0, 10).map((q) => ({
        label: q.subject,
        meta: q.customer.name ?? q.customer.email,
        href: `/queries/${q.queryId}`,
      }))
    : [];

  const leads = leadsRes.ok ? leadsRes.data.items : [];
  const newLeadItems = leads.filter((l) => l.status === "new");
  const overdueLeadItems = leads.filter((l) => l.overdue);

  const customersCount = customersRes.ok ? customersRes.data.items.length : 0;
  const products = productsRes.ok ? productsRes.data.items : [];
  const statusCounts = new Map<ProductStatus, number>();
  for (const p of products) statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);

  const data: DashboardData = {
    range,
    revenueByPeriod:
      "data" in revenueRes && revenueRes.ok
        ? mapRevenueByPeriod(revenueRes.data.rows as Array<Record<string, unknown>>)
        : [],
    // R8-04: money widgets come from the ledger / payments tables.
    ...finance,
    publishApprovals,
    splitApprovals,
    serviceChecklists: [],
    revocationTasks: [],
    newLeads: {
      count: newLeadItems.length,
      delta: "No data yet",
      items: newLeadItems.slice(0, 5).map((l) => ({
        label: l.name,
        meta: l.company ?? l.email ?? undefined,
        href: `/leads/${l.leadId}`,
      })),
    },
    funnel: [],
    overdueFollowUps: overdueLeadItems.slice(0, 5).map((l) => ({
      label: l.name,
      meta: l.company ?? l.email ?? undefined,
      href: `/leads/${l.leadId}`,
      tone: "warning",
    })),
    conversionRate: { value: 0, delta: "No data yet" },
    openQueries,
    visits: { total: 0, delta: "No data yet", top: [] },
    chatbotUsage: { platform: 0, platformCap: 0, usersAtCap: 0, perUserCap: 0 },
    catalogStatus: Array.from(statusCounts.entries()).map(([status, count]) => ({
      status,
      count,
    })),
    newCustomers: { count: customersCount, delta: "No data yet", sparkline: [] },
    systemHealth: [],
  };

  return (
    <AdminDashboard
      key={(savedLayout ?? []).join(",")}
      data={data}
      layout={savedLayout ?? undefined}
      isSuperAdmin={isSuperAdmin}
      greeting={`Welcome back, ${firstName}`}
      dateLabel={`FY ${fyFor(new Date())} · ${new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })}`}
    />
  );
}
