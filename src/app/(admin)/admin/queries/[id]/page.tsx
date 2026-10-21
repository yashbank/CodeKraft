import { QueriesInbox } from "@/components/admin/crm/QueriesInbox";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import {
  buildAdminNameMap,
  mapCustomerOptions,
  mapQueryRow,
  mapQueryThread,
} from "@/lib/admin/queries-view";
import {
  listAssignableAdminsQuery,
  listQueriesAdminQuery,
  getQueryAdminQuery,
} from "@/modules/queries/queries";
import { listCustomersQuery } from "@/modules/users/queries";
import { EmptyState } from "@/components/admin/EmptyState";
import { InboxIcon } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

/**
 * SCR-ADM-15 detail route (`/admin/queries/[id]`) — the sitemap documents the list (`/queries`)
 * and thread (`/queries/[id]`) routes as the same two-pane screen (ui/sitemap.md line 87), so
 * this reuses `QueriesInbox` exactly as the list page does, just seeded with the requested
 * query's thread instead of the first open one. Lets notification links / dashboard widgets /
 * other admin screens deep-link straight to a query instead of 404ing.
 */
export default async function AdminQueryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getAdminRequestContext();

  const [queriesResult, adminsResult, customersResult, threadResult] = await Promise.all([
    listQueriesAdminQuery({ limit: 100 }, ctx),
    listAssignableAdminsQuery({}, ctx),
    // `listCustomers` needs `customers.read`; an admin with only `queries.read`/`queries.reply`
    // still gets the page, just with an empty customer picker on "Log a query" (see below).
    listCustomersQuery({ limit: 100 }, ctx).catch(() => ({ ok: false as const })),
    getQueryAdminQuery({ queryId: id }, ctx),
  ]);

  if (!threadResult.ok) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="Query not found"
        body="It may have been deleted, or you may not have access to it."
      />
    );
  }

  const admins = adminsResult.ok ? adminsResult.data.items : [];
  const adminMap = buildAdminNameMap(admins);
  const queries = queriesResult.ok
    ? queriesResult.data.items.map((q) => mapQueryRow(q, adminMap))
    : [];
  const customers = mapCustomerOptions(
    "data" in customersResult && customersResult.ok
      ? customersResult.data.items.map((c) => ({
          id: c.user.id,
          name: c.user.name,
          email: c.user.email,
        }))
      : [],
  );

  const thread = mapQueryThread(threadResult.data, adminMap);

  return (
    <QueriesInbox
      queries={queries}
      thread={thread}
      admins={admins}
      customers={customers}
      now={new Date().toISOString()}
      approvalsHref="/admin/approvals"
      leadsHref="/admin/leads"
      customerHref="/admin/customers"
      chatbotHref="/admin/chatbot"
    />
  );
}
