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

export const dynamic = "force-dynamic";

export default async function AdminQueriesPage() {
  const ctx = await getAdminRequestContext();

  const [queriesResult, adminsResult, customersResult] = await Promise.all([
    listQueriesAdminQuery({ limit: 100 }, ctx),
    listAssignableAdminsQuery({}, ctx),
    // `listCustomers` needs `customers.read`; an admin with only `queries.read`/`queries.reply`
    // still gets the page, just with an empty customer picker on "Log a query" (see below).
    listCustomersQuery({ limit: 100 }, ctx).catch(() => ({ ok: false as const })),
  ]);

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

  const firstId = queriesResult.ok ? queriesResult.data.items[0]?.queryId : undefined;
  const threadResult = firstId ? await getQueryAdminQuery({ queryId: firstId }, ctx) : undefined;

  if (!threadResult || !threadResult.ok) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="No queries yet"
        body="Customer and visitor queries will appear here."
      />
    );
  }

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
