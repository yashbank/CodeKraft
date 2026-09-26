import { AdminUsers } from "@/components/admin/system/AdminUsers";
import {
  ADMIN_USERS,
  PRIYA,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return (
    <AdminUsers
      users={ADMIN_USERS}
      currentUserId={PRIYA.id}
      approvers={["Priya Nair", "Arjun Patel"]}
      approvalsHref="/admin/approvals"
      productHref="/admin/products"
      auditHref="/admin/audit"
    />
  );
}
