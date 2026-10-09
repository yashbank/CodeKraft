import { ApprovalsInbox } from "@/components/admin/commerce/ApprovalsInbox";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { getCurrentAdminUser } from "@/lib/admin/current-admin";
import {
  buildAdminNameMap,
  mapApprovalToItem,
  resolveSubjectLabels,
} from "@/lib/admin/approvals-view";
import { getDb } from "@/lib/db";
import { listApprovalsAction, listAdminDirectoryQuery } from "@/modules/approvals/queries";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const ctx = await getAdminRequestContext();
  const now = new Date().toISOString();

  const [approvalsResult, adminsResult, currentUser] = await Promise.all([
    listApprovalsAction({ limit: 100 }, ctx),
    listAdminDirectoryQuery({}, ctx),
    getCurrentAdminUser(ctx),
  ]);

  const admins = buildAdminNameMap(adminsResult.ok ? adminsResult.data.items : []);
  const rawApprovals = approvalsResult.ok ? approvalsResult.data.items : [];
  const labels = await resolveSubjectLabels(getDb(), rawApprovals);
  const approvals = rawApprovals.map((a) => mapApprovalToItem(a, admins, now, labels));

  return <ApprovalsInbox approvals={approvals} currentUser={currentUser} now={now} />;
}
