import { AuditLog } from "@/components/admin/system/AuditLog";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapAuditRow } from "@/lib/admin/audit-view";
import { listAuditLogsAction } from "@/modules/audit/queries";
import { listAdminUsersQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage() {
  const ctx = await getAdminRequestContext();
  const [logsResult, adminsResult] = await Promise.all([
    listAuditLogsAction({ limit: 100 }, ctx),
    listAdminUsersQuery({}, ctx),
  ]);

  const rows = logsResult.ok ? logsResult.data.items.map(mapAuditRow) : [];
  const admins = adminsResult.ok ? adminsResult.data.items.map((a) => a.name) : [];

  return <AuditLog rows={rows} admins={admins} approvalsHref="/admin/approvals" />;
}
