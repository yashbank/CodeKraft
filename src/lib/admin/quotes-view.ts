/**
 * View-model mapper for the admin Custom quotes screen (SCR-ADM-09): `custom_quotes` row ->
 * `QuoteRow`. The timeline is built from the lifecycle timestamps on the row.
 */
import { quotePayUrl } from "@/lib/routes";
import type { Currency } from "@/lib/money";
import type { CustomQuote } from "@/modules/quotes/types";
import type { CustomerOption, QuoteRow } from "@/components/admin/types";

export function mapQuoteRow(
  q: CustomQuote,
  customers: ReadonlyMap<string, CustomerOption>,
  offerings: ReadonlyMap<string, string> = new Map(),
): QuoteRow {
  const customer: CustomerOption = customers.get(q.customerId) ?? {
    id: q.customerId,
    name: "Unknown customer",
    email: "",
  };
  const timeline: QuoteRow["timeline"] = [
    { at: q.createdAt.toISOString(), actor: "Admin", text: "Created" },
  ];
  const push = (at: Date | null, actor: string, text: string) => {
    if (at) timeline.push({ at: at.toISOString(), actor, text });
  };
  push(q.sentAt, "Admin", "Sent to customer");
  push(q.viewedAt, "Customer", "Viewed by customer");
  push(q.acceptedAt, "Customer", "Accepted");
  push(q.rejectedAt, "Customer", "Rejected");
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  const expired =
    (q.status === "sent" || q.status === "viewed") && q.expiresAt && q.expiresAt < new Date();

  return {
    id: q.id,
    title: q.title,
    customer,
    offering: q.offeringId ? offerings.get(q.offeringId) : undefined,
    offeringId: q.offeringId ?? undefined,
    amount: { amountMinor: q.amountMinor, currency: q.currency as Currency },
    taxApplies: q.taxBps > 0,
    taxBps: q.taxBps,
    lineItems: q.lineItems ?? undefined,
    expiresAt: q.expiresAt ? q.expiresAt.toISOString() : "",
    status: expired ? "expired" : q.status,
    sentAt: q.sentAt ? q.sentAt.toISOString() : undefined,
    orderNumber: undefined,
    description: q.description ?? undefined,
    internalNote: q.internalNote ?? undefined,
    timeline,
    payLink: quotePayUrl(q.token),
  };
}
