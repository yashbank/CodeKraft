/**
 * View-model mapper for the admin Custom quotes screen (SCR-ADM-09) — `modules/quotes`'
 * `CustomQuote` row -> `components/admin/types.ts` `QuoteRow` shape. Kept out of the page and out
 * of the screen component, per the `queries-view.ts` / `customers-view.ts` convention.
 *
 * Known gaps vs. a fully fixture-populated screen (documented here, not fabricated):
 *  - `offering` is always left `undefined`. `custom_quotes.offering_id` has no admin-wide "list
 *    every offering with a <product> · <offering> label" query anywhere in this codebase
 *    (checked `catalog`/`offerings` modules — the only listing is scoped to one product at a
 *    time) — resolving it would need a new batched join query, out of scope for this pass.
 *  - `taxApplies` is always `false`. There is no `tax_applies` column on `custom_quotes`, and
 *    `quotesService.acceptCustomQuote` always posts the resulting order with `taxRateBps: 0` —
 *    so `false` matches real behaviour rather than guessing at a UI-only toggle.
 *  - `sentAt` is always `undefined`. There is no `sent_at` column on `custom_quotes` (only
 *    `created_at`), so the "Sent on" column has no real timestamp to show.
 *  - `orderNumber` is always `undefined`. `custom_quotes.order_id` exists, but resolving it to a
 *    display order number (`CK-ORD-000123`) would mean an extra per-quote `orders` lookup (no
 *    lightweight "order number by id" query exists — only the full admin order-detail query) —
 *    left unresolved rather than adding an N+1 fetch for a low-traffic admin list.
 *  - `internalNote` is always `undefined`. No matching column exists on `custom_quotes`.
 *  - `timeline` only ever contains a single "Created" entry (from `createdAt`). There is no
 *    per-quote audit trail joined into `listQuotes`'s output.
 *  - `payLink` is always the real `/quote/<token>` URL (`quotePayUrl`), even for a draft — the
 *    token exists from creation; only the screen's own UI gates copying it before `sent`.
 *  - `expiresAt` falls back to `""` when the quote has no expiry (it's optional on create) — the
 *    screen component guards every `formatDate`/`formatDateTime` call against an empty string.
 */
import { quotePayUrl } from "@/lib/routes";
import type { Currency } from "@/lib/money";
import type { CustomQuote } from "@/modules/quotes/types";
import type { CustomerOption, QuoteRow } from "@/components/admin/types";

export function mapQuoteRow(
  q: CustomQuote,
  customers: ReadonlyMap<string, CustomerOption>,
): QuoteRow {
  const customer: CustomerOption = customers.get(q.customerId) ?? {
    id: q.customerId,
    name: "Unknown customer",
    email: "",
  };

  return {
    id: q.id,
    title: q.title,
    customer,
    offering: undefined,
    amount: { amountMinor: q.amountMinor, currency: q.currency as Currency },
    taxApplies: false,
    expiresAt: q.expiresAt ? q.expiresAt.toISOString() : "",
    status: q.status,
    sentAt: undefined,
    orderNumber: undefined,
    description: q.description ?? undefined,
    internalNote: undefined,
    timeline: [{ at: q.createdAt.toISOString(), actor: "Admin", text: "Created" }],
    payLink: quotePayUrl(q.token),
  };
}
