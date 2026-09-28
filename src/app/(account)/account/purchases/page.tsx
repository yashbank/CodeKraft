import { PurchasesScreen } from "@/components/account/PurchasesScreen";
import { mapEntitlementSummary, mapOrderSummaryView } from "@/lib/account/purchases-view";
import { listMyEntitlementsQuery } from "@/modules/entitlements/queries";
import { listMyOrdersQuery } from "@/modules/orders/queries";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
  const ctx = await getSiteRequestContext();

  const [entitlementsResult, ordersResult] = await Promise.all([
    listMyEntitlementsQuery({ limit: 100 }, ctx),
    listMyOrdersQuery({ limit: 50 }, ctx),
  ]);

  const entitlements = entitlementsResult.ok
    ? entitlementsResult.data.items.map(mapEntitlementSummary)
    : [];
  const orders = ordersResult.ok ? ordersResult.data.items.map(mapOrderSummaryView) : [];
  const error =
    !entitlementsResult.ok || !ordersResult.ok
      ? "Couldn't load your purchases. Please try again."
      : undefined;

  return (
    <PurchasesScreen
      entitlements={entitlements}
      orders={orders}
      now={new Date().toISOString()}
      error={error}
      links={{
        entitlement: "/account/purchases",
        order: "/account/orders",
      }}
    />
  );
}
