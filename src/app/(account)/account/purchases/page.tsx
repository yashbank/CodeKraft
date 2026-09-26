import { PurchasesScreen } from "@/components/account/PurchasesScreen";
import {
  entitlements,
  orders,
} from "@/app/dev/screens/_fixtures/account";

export const dynamic = "force-dynamic";

export default function PurchasesPage() {
  const orderList = [
    orders.awaitingReference,
    orders.submitted,
    orders.confirmed,
  ];

  return (
    <PurchasesScreen
      entitlements={entitlements}
      orders={orderList}
      now={new Date().toISOString()}
      links={{
        entitlement: (id: string) => `/account/purchases/${id}`,
        order: (id: string) => `/account/orders/${id}`,
      }}
    />
  );
}
