import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { getSession } from "@/modules/auth/service";
import { listApprovalsAction } from "@/modules/approvals/queries";
import { listQueriesAdminQuery } from "@/modules/queries/queries";
import { listLeadsQuery } from "@/modules/leads/queries";
import { listCustomersQuery } from "@/modules/users/queries";
import { listProductsAdminQuery } from "@/modules/catalog/queries";
import type { DashboardData, QueueItem } from "@/components/admin/types";
import type { ProductStatus } from "@/components/admin/types";

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

export default async function AdminDashboardRoute() {
  const [ctx, session] = await Promise.all([getAdminRequestContext(), getSession()]);
  const isSuperAdmin = ctx.roles.includes("super_admin");
  const firstName = session?.user.name?.split(" ")[0] || "there";

  const [publishRes, splitRes, queriesRes, leadsRes, customersRes, productsRes] =
    await Promise.all([
      listApprovalsAction({ type: "product.publish", status: "pending", limit: 10 }, ctx),
      listApprovalsAction({ type: "project_order.split", status: "pending", limit: 10 }, ctx),
      listQueriesAdminQuery({ limit: 100, filters: { status: ["open"] } }, ctx),
      listLeadsQuery({ limit: 100 }, ctx),
      listCustomersQuery({ limit: 100 }, ctx),
      listProductsAdminQuery({ limit: 100 }, ctx),
    ]);

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
    range: "30d",
    revenueByPeriod: [],
    revenueByProduct: [],
    revenueByPartner: [],
    myShare: { valueInr: 0, delta: "No data yet", sparkline: [] },
    outstandingPayouts: { totalInr: 0, items: [] },
    expensesVsProfit: [],
    paymentsAwaiting: [],
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
      data={data}
      isSuperAdmin={isSuperAdmin}
      greeting={`Welcome back, ${firstName}`}
      dateLabel="FY 2026–27 · Today"
    />
  );
}
