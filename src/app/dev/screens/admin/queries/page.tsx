import { QueriesInbox } from "@/components/admin/crm/QueriesInbox";
import { ADMINS, CUSTOMER_OPTIONS, NOW, QUERIES, QUERY_THREAD, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-15 · Queries inbox + thread" };

export default function Page() {
  return (
    <PreviewShell active="/queries" title="Queries" summary="3 open queries">
      <QueriesInbox
        queries={QUERIES}
        thread={QUERY_THREAD}
        admins={ADMINS}
        customers={CUSTOMER_OPTIONS}
        now={NOW}
        approvalsHref={href("/approvals")}
        leadsHref={href("/leads")}
        customerHref={href("/customers") + "/detail"}
        chatbotHref={href("/chatbot")}
      />
    </PreviewShell>
  );
}
