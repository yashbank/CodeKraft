import { redirect } from "next/navigation";

import { getSession } from "@/modules/auth/service";
import { hasAdminClassRole, loadRoles } from "@/modules/auth/roles-port";
import { buildContext } from "@/lib/authz/context";
import { AdminShellWrapper } from "@/components/admin/AdminShellWrapper";
import { listApprovalsAction } from "@/modules/approvals/queries";
import { listNotificationsQuery } from "@/modules/notifications/queries";
import { mapNotificationItem } from "@/lib/admin/notifications-view";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
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

  const ctx = buildContext({
    user: { id: session.user.id },
    session: { id: session.session.id },
    roles,
  });

  const [approvalsRes, notificationsRes] = await Promise.all([
    listApprovalsAction({ status: "pending", limit: 100 }, ctx),
    listNotificationsQuery({ unreadOnly: true, limit: 20 }, ctx),
  ]);

  const pendingApprovals = approvalsRes.ok ? approvalsRes.data.items.length : 0;
  const notifications = notificationsRes.ok
    ? notificationsRes.data.items.map(mapNotificationItem)
    : [];

  const appEnv = getEnv().APP_ENV;
  const environment =
    appEnv === "production" ? "production" : appEnv === "staging" ? "staging" : "development";

  return (
    <AdminShellWrapper
      user={user}
      pendingApprovals={pendingApprovals}
      notifications={notifications}
      environment={environment}
    >
      {children}
    </AdminShellWrapper>
  );
}
