import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { audit } from "@/lib/audit-port";
import { hasAdminClassRole, loadRoles } from "@/modules/auth/roles-port";
import { getSession, hostFromHeaders } from "@/modules/auth/service";
import { AdminForbidden } from "@/components/admin/AdminForbidden";
import { AdminLoginPrompt } from "@/components/admin/AdminLoginPrompt";

export const dynamic = "force-dynamic";

/**
 * Admin area: only reachable through the admin host (middleware rewrite) and only for
 * admin-class sessions (docs/09 §3.1, §3.5). Full admin shell lands in P8.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  if (hostFromHeaders(h) !== "admin") notFound();
  const session = await getSession(h);
  if (!session) return <AdminLoginPrompt />;
  const roles = await loadRoles(session.user.id);
  if (!hasAdminClassRole(roles)) {
    await audit({
      action: "authz.admin_area.denied",
      actorId: session.user.id,
      meta: { path: "admin-layout" },
    });
    return <AdminForbidden />;
  }
  return <div data-app="admin">{children}</div>;
}
