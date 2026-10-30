import { InvoicesScreen } from "@/components/account/InvoicesScreen";
import {
  mapInvoiceRowsToSummaries,
  mapPaymentHistoryToSummaries,
} from "@/lib/account/invoices-view";
import { listMyInvoicesQuery } from "@/modules/invoices/queries";
import { getPaymentHistoryQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

/** `invoices.fy` is stored as `"2025-26"` (docs/05 §5); the picker shows `"FY 2025–26"`. */
function financialYears(invoices: { fy: string }[]): string[] {
  const years = Array.from(new Set(invoices.map((i) => i.fy)))
    .sort()
    .reverse()
    .map((fy) => `FY ${fy.replace("-", "\u2013")}`);
  return [...years, "all"];
}

export default async function InvoicesPage() {
  const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
  const ctx = await getSiteRequestContext();

  const [invoicesResult, paymentsResult] = await Promise.all([
    listMyInvoicesQuery({ limit: 100 }, ctx),
    getPaymentHistoryQuery({}, ctx),
  ]);

  const invoiceRows = invoicesResult.ok ? invoicesResult.data.items : [];
  const invoices = mapInvoiceRowsToSummaries(invoiceRows);
  const payments = paymentsResult.ok ? mapPaymentHistoryToSummaries(paymentsResult.data.items) : [];
  const error =
    !invoicesResult.ok || !paymentsResult.ok
      ? "Couldn't load your invoices. Please try again."
      : undefined;

  return (
    <InvoicesScreen
      invoices={invoices}
      payments={payments}
      financialYears={financialYears(invoiceRows)}
      error={error}
      links={{
        order: "/account/orders",
      }}
    />
  );
}
