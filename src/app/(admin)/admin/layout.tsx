import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { canOpenAdminRoute } from "@/lib/authz/admin-routes";
import { getSession } from "@/modules/auth/service";
import { hasAdminClassRole, loadRoles } from "@/modules/auth/roles-port";
import { buildContext } from "@/lib/authz/context";
import { AdminShellWrapper } from "@/components/admin/AdminShellWrapper";
import { listApprovalsAction } from "@/modules/approvals/queries";
import { listNotificationsQuery } from "@/modules/notifications/queries";
import { mapNotificationItem } from "@/lib/admin/notifications-view";
import { Banner } from "@/components/admin/Banner";
import { emailSenderProblem } from "@/lib/email/transport";
import { getEnv } from "@/lib/env";
import { getStoredEmailFrom } from "@/lib/site-brand";
import { enforcePasswordChange } from "@/lib/authz/must-change";

export const dynamic = "force-dynamic";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/auth/login?next=/dashboard");
  enforcePasswordChange(session);

  const roles = await loadRoles(session.user.id);
  if (!hasAdminClassRole(roles)) redirect("/auth/login?next=/dashboard");

  const user = {
    id: session.user.id,
    name: session.user.name || "Admin",
    email: session.user.email,
    role: roles.includes("super_admin")
      ? ("super_admin" as const)
      : roles.includes("admin")
        ? ("admin" as const)
        : ("staff" as const),
  };

  // Permission check first, before the shell (and its mobile "laptop" notice) renders.
  const path = (await headers()).get("x-request-path") ?? "";
  if (!canOpenAdminRoute(roles, path)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center" data-testid="admin-no-access">
          <h1 className="text-h2">You don&apos;t have access</h1>
          <p className="text-body text-fg-muted">
            Your role does not include this page. Ask an admin if you need it.
          </p>
          <Link href="/admin/dashboard" className="text-body underline">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const ctx = buildContext({
    user: { id: session.user.id },
    session: { id: session.session.id },
    roles,
  });

  const [approvalsRes, notificationsRes] = await Promise.all([
    listApprovalsAction({ filters: { status: "pending" }, limit: 100 }, ctx),
    listNotificationsQuery({ unreadOnly: true, limit: 20 }, ctx),
  ]);

  const pendingApprovals = approvalsRes.ok ? approvalsRes.data.items.length : 0;
  const notifications = notificationsRes.ok
    ? notificationsRes.data.items.map(mapNotificationItem)
    : [];

  const env = getEnv();
  const emailProblem = emailSenderProblem(env, await getStoredEmailFrom());
  const appEnv = env.APP_ENV;
  const environment =
    appEnv === "production" ? "production" : appEnv === "staging" ? "staging" : "development";

  return (
    <AdminShellWrapper
      user={user}
      pendingApprovals={pendingApprovals}
      notifications={notifications}
      unreadCount={notificationsRes.ok ? notificationsRes.data.unreadCount : 0}
      environment={environment}
    >
      {emailProblem ? (
        <Banner tone="danger" role="alert" title="Email sender not configured" className="mb-4">
          {emailProblem}. Verification, invite, quote and invoice emails will not reach customers.
        </Banner>
      ) : null}
      {children}
    </AdminShellWrapper>
  );
}
