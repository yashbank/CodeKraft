import { AuditLog } from "@/components/admin/system/AuditLog";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapAuditRow } from "@/lib/admin/audit-view";
import { listAuditLogsAction } from "@/modules/audit/queries";
import { listAdminUsersQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage() {
  const ctx = await getAdminRequestContext();
  const [logsResult, adminsResult] = await Promise.all([
    listAuditLogsAction({ limit: 25 }, ctx),
    listAdminUsersQuery({}, ctx),
  ]);

  const rows = logsResult.ok ? logsResult.data.items.map(mapAuditRow) : [];
  const nextCursor = logsResult.ok ? logsResult.data.nextCursor : null;
  const total = logsResult.ok ? (logsResult.data.total ?? rows.length) : rows.length;
  const admins = adminsResult.ok
    ? adminsResult.data.items.map((a) => ({ id: a.id, name: a.name }))
    : [];

  return (
    <AuditLog
      rows={rows}
      nextCursor={nextCursor}
      total={total}
      admins={admins}
      approvalsHref="/admin/approvals"
    />
  );
}
