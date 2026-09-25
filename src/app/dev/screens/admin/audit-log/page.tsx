import { AuditLog } from "@/components/admin/system/AuditLog";
import { AUDIT_ROWS, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-30 · Audit log" };

export default function Page() {
  return (
    <PreviewShell
      active="/audit"
      title="Audit log"
      summary="8 events in the last 7 days"
      breadcrumbs={[{ label: "System" }, { label: "Audit log" }]}
    >
      <AuditLog
        rows={AUDIT_ROWS}
        admins={["Priya Nair", "Arjun Mehta"]}
        approvalsHref={href("/approvals")}
      />
    </PreviewShell>
  );
}
