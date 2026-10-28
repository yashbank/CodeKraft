import { EntitlementsScreen } from "@/components/admin/commerce/EntitlementsScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapEntitlementRow } from "@/lib/admin/entitlements-view";
import { mapDeliveryTaskRow } from "@/lib/admin/delivery-view";
import { listDeliveryTasksQuery } from "@/modules/delivery/queries";
import { listEntitlementsAdminQuery } from "@/modules/entitlements/queries";
import { listAssignableAdminsQuery } from "@/modules/leads/queries";

export const dynamic = "force-dynamic";

export default async function AdminEntitlementsPage() {
  const ctx = await getAdminRequestContext();

  const [entitlementsResult, adminsResult, tasksResult] = await Promise.all([
    listEntitlementsAdminQuery({ limit: 100 }, ctx),
    listAssignableAdminsQuery({}, ctx).catch(() => ({ ok: false as const })),
    listDeliveryTasksQuery({ limit: 100, filters: {} }, ctx),
  ]);
  const tasks = tasksResult.ok ? tasksResult.data.items.map(mapDeliveryTaskRow) : [];

  const entitlements = entitlementsResult.ok
    ? entitlementsResult.data.items.map(mapEntitlementRow)
    : [];
  const admins = "data" in adminsResult && adminsResult.ok ? adminsResult.data.items : [];

  return (
    <EntitlementsScreen
      entitlements={entitlements}
      tasks={tasks}
      admins={admins}
      now={new Date().toISOString()}
      orderHref="/admin/orders"
      customerHref="/admin/customers"
      queriesHref="/admin/queries"
      initialView="entitlements"
    />
  );
}
