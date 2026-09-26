import { AuditLog } from "@/components/admin/system/AuditLog";
import {
  ADMINS,
  AUDIT_ROWS,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminAuditLogPage() {
  return (
    <AuditLog
      rows={AUDIT_ROWS}
      admins={ADMINS.map((a) => a.name)}
      approvalsHref="/admin/approvals"
    />
  );
}
