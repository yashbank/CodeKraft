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
    // `limit` is capped at `LIST_LIMIT_MAX` (100, src/modules/_shared/zod.ts) by the shared
    // `listParams` schema every list query uses — 200 here failed Zod validation on every
    // request, so `customersRes.ok` was always `false` and the "New quote" customer dropdown
    // silently rendered with zero options in production (confirmed via a real-browser repro:
    // the Select opened, `role=combobox`, but had no `option` children at all). Found by
    // real-browser testing, not previously caught by tsc/eslint/build since this is a runtime
    // validation failure the page swallows into an empty array rather than an error.
    listCustomersQuery({ limit: 100 }, ctx),
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
