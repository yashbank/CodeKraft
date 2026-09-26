import { redirect } from "next/navigation";

import { getSession } from "@/modules/auth/service";
import { hasAdminClassRole, loadRoles } from "@/modules/auth/roles-port";
import { AdminShellWrapper } from "@/components/admin/AdminShellWrapper";

export const dynamic = "force-dynamic";

export default async function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/auth/login?next=/dashboard");

  const roles = await loadRoles(session.user.id);
  if (!hasAdminClassRole(roles)) redirect("/auth/login?next=/dashboard");

  const user = {
    id: session.user.id,
    name: session.user.name || "Admin",
    email: session.user.email,
    role: roles.includes("super_admin") ? ("super_admin" as const) : ("admin" as const),
  };

  return <AdminShellWrapper user={user}>{children}</AdminShellWrapper>;
}
