import { EntitlementsScreen } from "@/components/admin/commerce/EntitlementsScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapEntitlementRow } from "@/lib/admin/entitlements-view";
import { listEntitlementsAdminQuery } from "@/modules/entitlements/queries";
import { listAssignableAdminsQuery } from "@/modules/leads/queries";

export const dynamic = "force-dynamic";

export default async function AdminEntitlementsPage() {
  const ctx = await getAdminRequestContext();

  const [entitlementsResult, adminsResult] = await Promise.all([
    listEntitlementsAdminQuery({ limit: 100 }, ctx),
    listAssignableAdminsQuery({}, ctx).catch(() => ({ ok: false as const })),
  ]);

  const entitlements = entitlementsResult.ok
    ? entitlementsResult.data.items.map(mapEntitlementRow)
    : [];
  const admins = "data" in adminsResult && adminsResult.ok ? adminsResult.data.items : [];

  return (
    <EntitlementsScreen
      entitlements={entitlements}
      // The delivery-task queue is a separate module (`modules/delivery`, owned by P5) whose
      // query/action wrappers are still P2.8 stubs — see `lib/admin/entitlements-view.ts`'s file
      // header. Left empty rather than faking task rows; the tab's own empty state covers it.
      tasks={[]}
      admins={admins}
      now={new Date().toISOString()}
      orderHref="/admin/orders"
      customerHref="/admin/customers"
      queriesHref="/admin/queries"
      initialView="entitlements"
    />
  );
}
