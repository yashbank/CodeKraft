import { QuotesScreen } from "@/components/admin/commerce/QuotesScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { listQuotesQuery } from "@/modules/quotes/queries";
import { listCustomersQuery } from "@/modules/users/queries";
import { mapQuoteRow } from "@/lib/admin/quotes-view";
import { mapCustomerOptions } from "@/lib/admin/queries-view";
import type { CustomerOption } from "@/components/admin/types";

export const dynamic = "force-dynamic";

export default async function AdminQuotesPage() {
  const ctx = await getAdminRequestContext();

  const [quotesRes, customersRes] = await Promise.all([
    listQuotesQuery({ limit: 100 }, ctx),
    listCustomersQuery({ limit: 200 }, ctx),
  ]);

  const customerOptions: CustomerOption[] = customersRes.ok
    ? mapCustomerOptions(customersRes.data.items.map((c) => c.user))
    : [];
  const customerMap = new Map(customerOptions.map((c) => [c.id, c]));

  const quotes = quotesRes.ok ? quotesRes.data.items.map((q) => mapQuoteRow(q, customerMap)) : [];

  return (
    <QuotesScreen
      quotes={quotes}
      customers={customerOptions}
      orderHref="/admin/orders"
      customerHref="/admin/customers"
    />
  );
}
