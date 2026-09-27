import { AdminUsers } from "@/components/admin/system/AdminUsers";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapAdminUserRow } from "@/lib/admin/admin-users-view";
import { listAdminUsersQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const ctx = await getAdminRequestContext();
  const result = await listAdminUsersQuery({}, ctx);
  const users = result.ok ? result.data.items.map(mapAdminUserRow) : [];
  const approvers = users
    .filter((u) => u.id !== ctx.userId && (u.role === "admin" || u.role === "super_admin"))
    .map((u) => u.name);

  return (
    <AdminUsers
      users={users}
      currentUserId={ctx.userId}
      approvers={approvers}
      approvalsHref="/admin/approvals"
      productHref="/admin/products"
      auditHref="/admin/audit"
    />
  );
}
