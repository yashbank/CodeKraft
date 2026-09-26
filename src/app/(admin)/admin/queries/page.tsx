import { QueriesInbox } from "@/components/admin/crm/QueriesInbox";
import {
  ADMINS,
  CUSTOMER_OPTIONS,
  QUERIES,
  QUERY_THREAD,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminQueriesPage() {
  return (
    <QueriesInbox
      queries={QUERIES}
      thread={QUERY_THREAD}
      admins={ADMINS}
      customers={CUSTOMER_OPTIONS}
      now={new Date().toISOString()}
      approvalsHref="/admin/approvals"
      leadsHref="/admin/leads"
      customerHref="/admin/customers"
      chatbotHref="/admin/chatbot"
    />
  );
}
