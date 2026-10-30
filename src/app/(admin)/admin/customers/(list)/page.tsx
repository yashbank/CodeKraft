import { CustomersList } from "@/components/admin/commerce/CustomersList";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapCustomerRow } from "@/lib/admin/customers-view";
import { listCustomersQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const ctx = await getAdminRequestContext();
  const result = await listCustomersQuery({ limit: 100 }, ctx);
  const customers = result.ok ? result.data.items.map(mapCustomerRow) : [];

  return (
    <CustomersList
      customers={customers}
      now={new Date().toISOString()}
      detailHref="/admin/customers"
      quotesHref="/admin/quotes"
      newOrderHref="/admin/orders/new"
    />
  );
}
