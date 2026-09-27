import { CustomerDetail } from "@/components/admin/commerce/CustomerDetail";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapCustomerDetail } from "@/lib/admin/customers-view";
import { mapOrderAdminRowToOrderRow } from "@/lib/admin/orders-view";
import { getCustomerQuery } from "@/modules/users/queries";
import { listOrdersAdminQuery } from "@/modules/orders/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getAdminRequestContext();
  const now = new Date().toISOString();

  const [customerResult, ordersResult] = await Promise.all([
    getCustomerQuery({ userId: id }, ctx),
    listOrdersAdminQuery({ limit: 50, filters: { userId: id } }, ctx),
  ]);

  if (!customerResult.ok) {
    // `getCustomer` throws NOT_FOUND for an unknown id; render nothing further rather than a
    // fabricated customer (there is no dedicated 404 UI wired for this screen yet).
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-fg-muted">
        Customer not found.
      </div>
    );
  }

  const orders = ordersResult.ok ? ordersResult.data.items : [];
  const data = mapCustomerDetail(customerResult.data, orders, mapOrderAdminRowToOrderRow, now);

  return (
    <CustomerDetail
      data={data}
      now={now}
      orderHref="/admin/orders"
      queriesHref="/admin/queries"
      quotesHref="/admin/quotes"
      newOrderHref="/admin/orders/new"
      auditHref="/admin/audit"
    />
  );
}
