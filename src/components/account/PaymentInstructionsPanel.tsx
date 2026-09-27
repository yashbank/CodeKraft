"use client";

/**
 * Post-order "pay and submit your reference" panel, shared by `CheckoutScreen` (new purchase) and
 * `QuoteScreen` (accepted custom quote) — both flows land here with the same `OrderPaymentHandle`
 * shape from `createOrder`/`acceptCustomQuote`.
 *
 * This is deliberately NOT a "payment successful" screen: this codebase only ships manual UPI /
 * bank-transfer payment (release 1, D-501) — there is no payment-gateway integration to redirect
 * to or poll. Placing the order is real (a `pending_payment` order + a real `payments` row exist
 * after this), and submitting a reference here is real (`payments.submitted`, `modules/payments`
 * API-PAY-02) — but the payment is only actually confirmed once an admin verifies the transfer and
 * calls `confirmPayment` (`payments.confirm`), which is out of the customer app entirely. If a
 * non-manual method ever reaches this panel (it can't today — `createOrder`'s `paymentMethod` only
 * accepts `manual_upi`/`manual_bank`), it's shown as an explicit "not wired" state, not a fake
 * success.
 */
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "@/lib/money";
import { submitPaymentReference } from "@/modules/payments/customer-mutations";
import type { PaymentInstructions } from "@/modules/payments/provider";
import { Banner } from "./Banner";

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-body-sm">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={mono ? "font-mono tnum text-right" : "text-right"}>{value}</dd>
    </div>
  );
}

export function PaymentInstructionsPanel({
  orderNo,
  paymentId,
  instructions,
  expiresAt,
  dashboardHref,
}: {
  orderNo: string;
  paymentId: string;
  instructions: PaymentInstructions;
  expiresAt: string;
  dashboardHref: string;
}) {
  const [reference, setReference] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ref = reference.trim();
    if (ref.length < 6) return;
    setSubmitting(true);
    const result = await submitPaymentReference({ paymentId, reference: ref });
    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
      toast.success("Reference submitted — we'll confirm it shortly");
    } else {
      toast.error(result.error.message);
    }
  }

  return (
    <div className="mx-auto max-w-[640px] space-y-6 rounded-xl border border-border bg-surface p-6 shadow-2 sm:p-8">
      <Banner tone="success" title={`Order ${orderNo} placed`}>
        This order is <strong>pending payment</strong>, not paid. Complete the transfer below, then
        submit your reference — we confirm manually (usually within 1 working day) and access
        unlocks once we do.
      </Banner>

      {instructions.method === "manual_upi" ? (
        <section className="space-y-3">
          <h2 className="text-h4 text-fg">Pay via UPI</h2>
          {instructions.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={instructions.qrDataUrl}
              alt="Scan to pay with any UPI app"
              className="size-40 rounded-lg border border-border"
            />
          ) : null}
          <dl className="divide-y divide-border">
            <Row label="UPI ID" value={instructions.vpa} mono />
            <Row label="Payee" value={instructions.payeeName} />
            <Row label="Amount" value={format(instructions.amount)} mono />
            <Row label="Note (enter this on transfer)" value={instructions.note} mono />
          </dl>
        </section>
      ) : instructions.method === "manual_bank" ? (
        <section className="space-y-3">
          <h2 className="text-h4 text-fg">Pay via bank transfer</h2>
          <dl className="divide-y divide-border">
            <Row label="Account name" value={instructions.accountName} />
            <Row label="Account number" value={instructions.accountNo} mono />
            <Row label="IFSC" value={instructions.ifsc} mono />
            <Row label="Bank" value={instructions.bankName} />
            {instructions.branch ? <Row label="Branch" value={instructions.branch} /> : null}
            {instructions.swift ? <Row label="SWIFT" value={instructions.swift} mono /> : null}
            <Row label="Amount" value={format(instructions.amount)} mono />
            <Row label="Reference (quote on transfer)" value={instructions.reference} mono />
          </dl>
        </section>
      ) : (
        <Banner tone="warning" title="This payment method isn't backed by a real integration">
          Payment via &ldquo;{instructions.method}&rdquo; has no live provider connected in this
          build — there is no real way to pay through it yet. Please open a query and we&apos;ll
          arrange payment another way.
        </Banner>
      )}

      <p className="text-caption text-fg-muted">
        Complete payment by {new Date(expiresAt).toLocaleString()} — unpaid orders are cancelled
        automatically after that.
      </p>

      {submitted ? (
        <Banner tone="info" title="Reference submitted — awaiting confirmation">
          We have not confirmed this payment yet. Check status any time from{" "}
          <a className="underline" href={dashboardHref}>
            your purchases
          </a>
          .
        </Banner>
      ) : (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="pay-ref" required>
              Transfer reference (UTR / transaction id)
            </Label>
            <Input
              id="pay-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              minLength={6}
              maxLength={64}
              required
              placeholder="e.g. 123456789012"
            />
          </div>
          <Button type="submit" disabled={submitting || reference.trim().length < 6}>
            {submitting ? "Submitting…" : "I've paid — submit reference"}
          </Button>
        </form>
      )}
    </div>
  );
}
