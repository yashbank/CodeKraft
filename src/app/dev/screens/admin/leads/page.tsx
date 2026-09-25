import { LeadsScreen } from "@/components/admin/crm/LeadsScreen";
import { ADMINS, CURRENT_ADMIN, LEADS, NOW, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-13 · Leads list + pipeline" };

export default function Page() {
  return (
    <PreviewShell active="/leads" title="Leads" summary="8 leads · 2 overdue follow-ups">
      <LeadsScreen
        leads={LEADS}
        admins={ADMINS}
        currentUser={CURRENT_ADMIN}
        now={NOW}
        detailHref={href("/leads") + "/detail"}
        newOrderHref={href("/orders/new")}
      />
    </PreviewShell>
  );
}
