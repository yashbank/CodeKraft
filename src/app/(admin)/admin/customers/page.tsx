import { CustomersList } from "@/components/admin/commerce/CustomersList";
import { CUSTOMERS } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminCustomersPage() {
  return (
    <CustomersList
      customers={CUSTOMERS}
      now={new Date().toISOString()}
      detailHref="/admin/customers"
      quotesHref="/admin/quotes"
      newOrderHref="/admin/orders/new"
    />
  );
}
