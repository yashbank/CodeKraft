import { AdminUsers } from "@/components/admin/system/AdminUsers";
import { ADMIN_USERS, CURRENT_ADMIN, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-31 · Admin users & roles" };

export default function Page() {
  return (
    <PreviewShell
      active="/admin-users"
      title="Admin users"
      breadcrumbs={[{ label: "System" }, { label: "Admin users" }]}
    >
      <AdminUsers
        users={ADMIN_USERS}
        currentUserId={CURRENT_ADMIN.id}
        approvers={["Arjun Mehta"]}
        approvalsHref={href("/approvals")}
        productHref={href("/products/new")}
        auditHref={href("/audit")}
      />
    </PreviewShell>
  );
}
