import { ApprovalsInbox } from "@/components/admin/commerce/ApprovalsInbox";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { getCurrentAdminUser } from "@/lib/admin/current-admin";
import { buildAdminNameMap, mapApprovalToItem } from "@/lib/admin/approvals-view";
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
  const approvals = approvalsResult.ok
    ? approvalsResult.data.items.map((a) => mapApprovalToItem(a, admins, now))
    : [];

  return <ApprovalsInbox approvals={approvals} currentUser={currentUser} now={now} />;
}
