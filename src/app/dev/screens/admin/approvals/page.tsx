import { ApprovalsInbox } from "@/components/admin/commerce/ApprovalsInbox";
import { APPROVALS, CURRENT_ADMIN, NOW } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-05 · Approvals inbox" };

export default function Page() {
  return (
    <PreviewShell active="/approvals" title="Approvals" readMostly>
      <ApprovalsInbox approvals={APPROVALS} currentUser={CURRENT_ADMIN} now={NOW} />
    </PreviewShell>
  );
}
