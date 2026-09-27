/**
 * View-model mappers for the customer Invoices screen (SCR-ACC-04) --
 * `modules/invoices`'s `InvoiceRow` (with its nested `creditNotes`) -> a flat
 * `components/account/types.ts` `InvoiceSummary[]` (one row per invoice, one per credit note),
 * and `modules/users`'s `PaymentHistoryItem` -> `PaymentSummary`. Kept out of the page and the
 * screen component, per the admin `orders-view.ts` convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `InvoiceSummary.description` / `PaymentSummary` have no free-text order description to draw
 *    on (`listMyInvoices` / `getPaymentHistory` return no joined order-item text), so the
 *    description is just "Order {orderNo}".
 *  - `InvoiceSummary.displayAmount` is always unset -- neither source row carries an FX-converted
 *    display-currency amount.
 *  - `PaymentSummary.orderOpen` is inferred from the payment's own status only (no separate read
 *    of the order's current status), so it may read "open" for a payment whose order later
 *    expired for an unrelated reason.
 */
import type { InvoiceSummary, PaymentSummary } from "@/components/account/types";
import { money, type Currency } from "@/lib/money";
import type { PaymentHistoryItem } from "@/modules/users/types";
import type { InvoiceRow } from "@/modules/invoices/types";

function invoiceStatus(row: InvoiceRow): InvoiceSummary["status"] {
  const creditedMinor = row.creditNotes.reduce((sum, cn) => sum + cn.amountMinor, 0);
  if (creditedMinor <= 0) return "paid";
  return creditedMinor >= row.totalMinor ? "refunded" : "partially_refunded";
}

export function mapInvoiceRowsToSummaries(rows: InvoiceRow[]): InvoiceSummary[] {
  const out: InvoiceSummary[] = [];
  for (const row of rows) {
    const currency = row.currency as Currency;
    out.push({
      id: row.invoiceId,
      kind: "invoice",
      number: row.invoiceNo,
      date: row.issuedAt,
      orderNumber: row.orderNo,
      description: `Order ${row.orderNo}`,
      amount: money(row.totalMinor, currency),
      tax: row.taxMinor > 0 ? money(row.taxMinor, currency) : null,
      status: invoiceStatus(row),
    });
    for (const cn of row.creditNotes) {
      out.push({
        id: cn.creditNoteId,
        kind: "credit_note",
        number: cn.creditNo,
        forInvoiceNumber: row.invoiceNo,
        date: cn.issuedAt,
        orderNumber: row.orderNo,
        description: `Credit note for ${row.invoiceNo}`,
        amount: money(-cn.amountMinor, currency),
        tax: null,
        status: "refunded",
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const OPEN_PAYMENT_STATUSES = new Set(["initiated", "submitted"]);

export function mapPaymentHistoryToSummaries(items: PaymentHistoryItem[]): PaymentSummary[] {
  return items.map((p) => ({
    id: p.paymentId,
    date: p.submittedAt ?? p.confirmedAt ?? new Date(0).toISOString(),
    orderNumber: p.orderNo,
    orderHref: `/account/orders/${p.orderNo}`,
    provider: p.method as PaymentSummary["provider"],
    amountDue: money(p.amountDue.amountMinor, p.amountDue.currency),
    reference: p.reference ?? undefined,
    status: p.status as PaymentSummary["status"],
    orderOpen: OPEN_PAYMENT_STATUSES.has(p.status),
  }));
}
