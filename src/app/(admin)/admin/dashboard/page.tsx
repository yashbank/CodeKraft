import { SetupChecklist } from "@/components/admin/dashboard/SetupChecklist";
import { loadSetupChecklist } from "@/lib/admin/setup-checklist-data";
import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { getSession } from "@/modules/auth/service";
import {
  DASHBOARD_RANGES,
  loadDashboardData,
  type DashboardRange,
} from "@/lib/admin/dashboard-data";
import { fyFor } from "@/lib/dates";
import { getAdminWidgetLayout } from "@/modules/dashboard-widgets/admin-layout";

export const dynamic = "force-dynamic";

export default async function AdminDashboardRoute({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const [ctx, session, sp] = await Promise.all([
    getAdminRequestContext(),
    getSession(),
    searchParams,
  ]);
  const range: DashboardRange = (DASHBOARD_RANGES as readonly string[]).includes(sp.range ?? "")
    ? (sp.range as DashboardRange)
    : "30d";
  const isSuperAdmin = ctx.roles.includes("super_admin");
  const firstName = session?.user.name?.split(" ")[0] || "there";
  // R8-10 — the admin's own saved widget selection/order (null → default layout).
  const savedLayout = await getAdminWidgetLayout(ctx.userId).catch(() => null);

  const [data, checklist] = await Promise.all([
    loadDashboardData(ctx, range),
    isSuperAdmin ? loadSetupChecklist(ctx) : Promise.resolve([]),
  ]);

  return (
    <>
      {checklist.length > 0 ? <SetupChecklist items={checklist} userId={ctx.userId} /> : null}
      <AdminDashboard
        key={(savedLayout ?? []).join(",")}
        data={data}
        layout={savedLayout ?? undefined}
        isSuperAdmin={isSuperAdmin}
        greeting={`Welcome back, ${firstName}`}
        dateLabel={`FY ${fyFor(new Date())} · ${new Date().toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        })}`}
      />
    </>
  );
}
