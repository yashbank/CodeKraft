import { QuotesScreen } from "@/components/admin/commerce/QuotesScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { listQuotesQuery } from "@/modules/quotes/queries";
import { getCustomerQuery, listCustomersQuery } from "@/modules/users/queries";
import { mapQuoteRow } from "@/lib/admin/quotes-view";
import { listPublishedProductOfferingOptions } from "@/modules/offerings/queries";
import { mapCustomerOptions } from "@/lib/admin/queries-view";
import type { CustomerOption, QuoteOfferingOption } from "@/components/admin/types";

export const dynamic = "force-dynamic";

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const prefill = one("customerId")
    ? { customerId: one("customerId"), title: one("title"), description: one("description") }
    : undefined;
  const ctx = await getAdminRequestContext();

  const [quotesRes, customersRes, offeringOptions] = await Promise.all([
    listQuotesQuery({ limit: 100 }, ctx),
    // `limit` is capped at `LIST_LIMIT_MAX` (100, src/modules/_shared/zod.ts) by the shared
    // `listParams` schema every list query uses — 200 here failed Zod validation on every
    // request, so `customersRes.ok` was always `false` and the "New quote" customer dropdown
    // silently rendered with zero options in production (confirmed via a real-browser repro:
    // the Select opened, `role=combobox`, but had no `option` children at all). Found by
    // real-browser testing, not previously caught by tsc/eslint/build since this is a runtime
    // validation failure the page swallows into an empty array rather than an error.
    listCustomersQuery({ limit: 100 }, ctx),
    listPublishedProductOfferingOptions(ctx).catch(() => []),
  ]);
  const offerings: QuoteOfferingOption[] = offeringOptions.map((o) => ({
    id: o.id,
    label: o.label,
    price: o.price,
  }));

  const customerOptions: CustomerOption[] = customersRes.ok
    ? mapCustomerOptions(customersRes.data.items.map((c) => c.user))
    : [];
  // The prefilled customer (from Customers / Leads) may not be in the first 100: always include it.
  if (prefill?.customerId && !customerOptions.some((c) => c.id === prefill.customerId)) {
    const one = await getCustomerQuery({ userId: prefill.customerId }, ctx);
    if (one.ok) customerOptions.unshift(...mapCustomerOptions([one.data.user]));
  }
  const customerMap = new Map(customerOptions.map((c) => [c.id, c]));
  const offeringLabels = new Map(offerings.map((o) => [o.id, o.label]));

  const quotes = quotesRes.ok
    ? quotesRes.data.items.map((q) => mapQuoteRow(q, customerMap, offeringLabels))
    : [];

  return (
    <QuotesScreen
      prefill={prefill}
      quotes={quotes}
      customers={customerOptions}
      offerings={offerings}
      loadError={quotesRes.ok ? undefined : quotesRes.error.message}
      orderHref="/admin/orders"
      customerHref="/admin/customers"
    />
  );
}
