/**
 * View-model mapper for the customer Quote pay page (SCR-ACC-12) -- `modules/quotes`'s
 * `QuoteView` (module) -> `components/account/types.ts`'s `QuoteView` (component). Kept out of the
 * page and out of the screen component, per the `purchases-view.ts` convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `product` is always left unset -- `getQuote`'s `Pick<CustomQuote, ...>` deliberately excludes
 *    `offeringId` (a quote need not be tied to a catalog product at all), so there is no product
 *    name/offering to show.
 *  - `preparedFor` has no real name/email to source from the same `Pick` -- it reads the viewer's
 *    own account email when they're the invited customer, and a generic phrase otherwise.
 *  - `includes` is always `[]` -- there's no "what's included" list on `custom_quotes`; the screen
 *    hides that section entirely when the list is empty (see `QuoteScreen`) rather than show a
 *    fabricated bullet list.
 *  - `tax`/`taxLabel` -- custom quotes are never taxed in this codebase (`acceptCustomQuote` always
 *    writes `taxMinor: 0`), so `tax` is always `null`; `taxLabel` is unused in that case and carries
 *    a harmless placeholder.
 *  - `paymentMethods` defaults to both manual methods (`manual_upi`, `manual_bank`) -- the only two
 *    payment rails this app has (release 1, D-501) -- since `getQuote` doesn't return a
 *    per-quote enabled-methods list.
 *  - `orderHref` / `entitlementHref` point at the Purchases dashboard, not a per-order/entitlement
 *    detail page -- neither route exists yet in this codebase.
 */
import type { BillingDetails, QuoteView as ComponentQuoteView } from "@/components/account/types";
import { assertCurrency } from "@/lib/money";
import type { QuoteView as ModuleQuoteView } from "@/modules/quotes/types";

export function mapQuoteView(
  v: ModuleQuoteView,
  opts: { customerEmail: string },
): ComponentQuoteView {
  const q = v.quote;
  return {
    token: "", // filled in by the caller (the token isn't part of the module's QuoteView)
    title: q.title,
    preparedFor: v.canAccept ? opts.customerEmail : "another customer",
    validUntil: q.expiresAt ? q.expiresAt.toISOString() : new Date(8640000000000000).toISOString(),
    status: q.status,
    description: q.description ? [q.description] : [],
    amount: { amountMinor: q.amountMinor, currency: assertCurrency(q.currency) },
    tax: null,
    taxLabel: "GST",
    includes: [],
    paymentMethods: ["manual_upi", "manual_bank"],
    orderHref: q.orderId ? "/account/purchases" : undefined,
    entitlementHref: q.status === "paid" ? "/account/purchases" : undefined,
  };
}

export function defaultBilling(email: string): BillingDetails & { email: string } {
  return { name: "", country: "IN", email };
}
