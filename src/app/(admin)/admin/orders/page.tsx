import { OrdersList } from "@/components/admin/commerce/OrdersList";
import { ORDERS } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminOrdersPage() {
  return (
    <OrdersList
      orders={ORDERS}
      now={new Date().toISOString()}
      detailHref="/admin/orders"
      newOrderHref="/admin/orders/new"
      customerHref="/admin/customers"
      approvalsHref="/admin/approvals"
      notificationsHref="/admin/notifications"
    />
  );
}
