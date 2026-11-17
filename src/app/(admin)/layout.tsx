import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { audit } from "@/lib/audit-port";
import { hasAdminClassRole, loadRoles } from "@/modules/auth/roles-port";
import { getSession, hostFromHeaders } from "@/modules/auth/service";
import { AdminForbidden } from "@/components/admin/AdminForbidden";
import { DEFAULT_ADMIN_ICON } from "@/lib/brand-constants";
import { areaMetadata } from "@/lib/seo";
import { getSiteLogo, getSiteName, getThemeConfig } from "@/lib/site-brand";
import { ThemeSync } from "@/components/site/ThemeSync";
import { isThemePref } from "@/lib/theme";
import { redirectToLogin } from "@/lib/authz/login-redirect";

export const dynamic = "force-dynamic";

/** BUG-074: tinted favicon so admin tabs are distinguishable from the storefront. */
export async function generateMetadata() {
  const [siteName, logo] = await Promise.all([getSiteName(), getSiteLogo()]);
  return areaMetadata("Admin", siteName, logo, DEFAULT_ADMIN_ICON);
}

/**
 * Admin area: only reachable through the admin host (middleware rewrite) and only for
 * admin-class sessions (docs/09 §3.1, §3.5). Full admin shell lands in P8.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  if (hostFromHeaders(h) !== "admin") notFound();
  const session = await getSession(h);
  if (!session) return redirectToLogin("/");
  const roles = await loadRoles(session.user.id);
  if (!hasAdminClassRole(roles)) {
    await audit({
      action: "authz.admin_area.denied",
      actorId: session.user.id,
      meta: { path: "admin-layout" },
    });
    return <AdminForbidden />;
  }
  const { themeToggle } = await getThemeConfig();
  const themePref = (session.user as { themePref?: string | null }).themePref;
  return (
    <div data-app="admin">
      {themeToggle ? <ThemeSync pref={isThemePref(themePref) ? themePref : null} /> : null}
      {children}
    </div>
  );
}
