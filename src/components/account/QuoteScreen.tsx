"use client";

import Link from "next/link";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { add, format } from "@/lib/money";
import { Banner } from "./Banner";
import { BillingFields, PaymentMethodChoice } from "./CheckoutScreen";
import { DELIVERY_LABELS } from "./DeliveryTypeIcon";
import { formatDate, timeUntil } from "./format";
import { ProductCover } from "./ProductCover";
import type { BillingDetails, PaymentProvider, QuoteView } from "./types";

/**
 * SCR-ACC-12 — custom quote pay page (D-520): private quote card with status banner, amount block,
 * "What's included", payment method, billing (collapsed when complete), consent and "Accept & pay".
 * `canAccept=false` renders the read-only variant for a different signed-in customer.
 */
export function QuoteScreen({
  quote: q,
  billing,
  customerEmail,
  canAccept,
  now,
  links,
  loading = false,
}: {
  quote: QuoteView;
  billing: BillingDetails;
  customerEmail: string;
  canAccept: boolean;
  now: string;
  links: { newQuery: string; switchAccount: string };
  loading?: boolean;
}) {
  const [bill, setBill] = React.useState<BillingDetails>(billing);
  const [editBilling, setEditBilling] = React.useState(!billing.country || !billing.name);
  const [method, setMethod] = React.useState<PaymentProvider>(q.paymentMethods[0] ?? "manual_upi");
  const [consent, setConsent] = React.useState(false);
  const total = q.tax ? add(q.amount, q.tax) : q.amount;
  const remaining = timeUntil(q.validUntil, now);
  const payable = q.status === "sent" && canAccept && !!remaining;

  if (loading) {
    return (
      <div className="mx-auto max-w-[720px] space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  let banner: React.ReactNode = null;
  if (!canAccept) {
    banner = (
      <Banner
        tone="warning"
        title="This quote was prepared for another customer"
        action={
          <Button size="sm" variant="secondary" asChild>
            <Link href={links.switchAccount}>Switch account</Link>
          </Button>
        }
      >
        Sign in as the invited customer to accept and pay.
      </Banner>
    );
  } else if (q.status === "accepted") {
    banner = (
      <Banner
        tone="info"
        title="Accepted"
        action={
          q.orderHref ? (
            <Button size="sm" asChild>
              <Link href={q.orderHref}>Open order</Link>
            </Button>
          ) : undefined
        }
      >
        An order was created from this quote — pay it to unlock delivery.
      </Banner>
    );
  } else if (q.status === "paid") {
    banner = (
      <Banner
        tone="success"
        title="Paid"
        action={
          q.entitlementHref ? (
            <Button size="sm" asChild>
              <Link href={q.entitlementHref}>Open purchase</Link>
            </Button>
          ) : undefined
        }
      >
        Thanks — this quote is paid and delivery is under way.
      </Banner>
    );
  } else if (q.status === "expired" || !remaining) {
    banner = (
      <Banner
        tone="neutral"
        title="This quote has expired — ask us for a refreshed one"
        action={
          <Button size="sm" variant="secondary" asChild>
            <Link href={links.newQuery}>Open a query</Link>
          </Button>
        }
      />
    );
  } else if (q.status === "cancelled") {
    banner = (
      <Banner tone="danger" title="This quote was cancelled">
        Open a query if you'd like a new one.
      </Banner>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      {banner}
      <article className="space-y-6 rounded-xl border border-border bg-surface p-6 shadow-2 sm:p-8">
        <header className="space-y-2">
          <p className="text-overline font-semibold tracking-wider text-accent-text uppercase">
            Private quote
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h2 text-fg">{q.title}</h1>
            <StatusBadge kind="custom_quotes.status" value={q.status} size="sm" />
          </div>
          <p className="flex flex-wrap items-center gap-2 text-body-sm text-fg-muted">
            Prepared for {q.preparedFor} · valid until {formatDate(q.validUntil)}
            {remaining ? (
              <Badge tone="warning" size="sm">
                {remaining} left
              </Badge>
            ) : (
              <Badge tone="ghost" size="sm">
                Expired
              </Badge>
            )}
          </p>
        </header>

        <div className="space-y-2 text-body text-fg-muted">
          {q.description.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        {q.product ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-canvas p-3">
            <ProductCover name={q.product.name} className="size-12" />
            <div className="text-body-sm">
              <p className="font-semibold text-fg">{q.product.name}</p>
              <p className="text-fg-muted">
                {q.product.offeringName} · {DELIVERY_LABELS[q.product.deliveryType]}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-caption text-fg-muted">Amount</p>
            <p className="font-mono text-price text-fg">{format(total)}</p>
            <p className="text-caption text-fg-muted">
              {q.amount.amountMinor !== total.amountMinor
                ? `${format(q.amount)} + ${q.taxLabel} ${q.tax ? format(q.tax) : ""}`
                : "No tax"}
              {q.displayAmount ? ` · ≈ ${format(q.displayAmount)}` : ""}
            </p>
          </div>
          <p className="text-caption text-fg-subtle">
            Quotes are private to you and expire on {formatDate(q.validUntil)}.
          </p>
        </div>

        <section aria-labelledby="quote-includes" className="space-y-2">
          <h2 id="quote-includes" className="text-h4 text-fg">
            What&apos;s included
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-body-sm text-fg-muted">
            {q.includes.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>

        {payable ? (
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <section aria-labelledby="quote-pay" className="space-y-3">
              <h2 id="quote-pay" className="text-h4 text-fg">
                Payment method
              </h2>
              <PaymentMethodChoice methods={q.paymentMethods} value={method} onChange={setMethod} />
            </section>
            <section aria-labelledby="quote-billing" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="quote-billing" className="text-h4 text-fg">
                  Billing details
                </h2>
                {!editBilling ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setEditBilling(true)}
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
              {editBilling ? (
                <BillingFields
                  value={bill}
                  onChange={setBill}
                  emailReadOnly={customerEmail}
                  idPrefix="qbill"
                />
              ) : (
                <p className="text-body-sm text-fg-muted">
                  {bill.name}
                  {bill.company ? ` · ${bill.company}` : ""} · {bill.country}
                  {bill.gstNumber ? ` · GSTIN ${bill.gstNumber}` : ""}
                </p>
              )}
            </section>
            <div className="flex items-start gap-2">
              <Checkbox
                id="quote-consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="quote-consent" className="items-start leading-snug font-medium">
                <span>
                  I agree to the{" "}
                  <Link href="/legal/terms" className="text-accent-text underline">
                    Terms of service
                  </Link>{" "}
                  and{" "}
                  <Link href="/legal/refunds" className="text-accent-text underline">
                    Refund &amp; cancellation policy
                  </Link>
                </span>
              </Label>
            </div>
            <div className="sticky bottom-0 -mx-6 flex flex-col gap-2 border-t border-border bg-surface/95 p-4 backdrop-blur sm:static sm:m-0 sm:flex-row sm:border-0 sm:bg-transparent sm:p-0">
              <Button type="submit" size="lg" disabled={!consent}>
                Accept &amp; pay {format(total)}
              </Button>
              <Button type="button" size="lg" variant="ghost" asChild>
                <Link href={links.newQuery}>Ask a question</Link>
              </Button>
            </div>
          </form>
        ) : canAccept ? (
          <Button variant="ghost" asChild>
            <Link href={links.newQuery}>Ask a question</Link>
          </Button>
        ) : null}
      </article>
    </div>
  );
}
