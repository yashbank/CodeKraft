import { OrdersList } from "@/components/admin/commerce/OrdersList";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapOrderAdminRowToOrderRow } from "@/lib/admin/orders-view";
import { listOrdersAdminQuery } from "@/modules/orders/queries";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const ctx = await getAdminRequestContext();
  const now = new Date().toISOString();

  const result = await listOrdersAdminQuery({ limit: 100 }, ctx);
  const orders = result.ok ? result.data.items.map((row) => mapOrderAdminRowToOrderRow(row, now)) : [];

  return (
    <OrdersList
      orders={orders}
      now={now}
      detailHref="/admin/orders"
      newOrderHref="/admin/orders/new"
      customerHref="/admin/customers"
      approvalsHref="/admin/approvals"
      notificationsHref="/admin/notifications"
    />
  );
}
