"use client";

/**
 * Post-order "pay and submit your reference" panel, shared by `CheckoutScreen` (new purchase) and
 * `QuoteScreen` (accepted custom quote) — both flows land here with the same `OrderPaymentHandle`
 * shape from `createOrder`/`acceptCustomQuote`.
 *
 * Release 1 (D-501) only ships manual UPI/bank-transfer payment: placing the order is real (a
 * `pending_payment` order + a real `payments` row exist after this), and submitting a reference
 * here is real (`payments.submitted`, `modules/payments` API-PAY-02) — but the payment is only
 * actually confirmed once an admin verifies the transfer and calls `confirmPayment`
 * (`payments.confirm`), out of the customer app entirely.
 *
 * V1.1 (D-501, TEST MODE ONLY) adds Razorpay: `createIntent` returns a `GatewayInstructions`
 * (`method: "razorpay"`) carrying a non-secret `keyId` and a `razorpayOrderId` — loaded here via
 * Razorpay's own `checkout.js` (never bundled, always test mode: `https://checkout.razorpay.com/
 * v1/checkout.js`). On success we still call the SAME `submitPaymentReference` the manual flow
 * uses (API-PAY-02) — not a parallel "confirm" call — packing the reference as
 * `"<razorpay_order_id>:<razorpay_payment_id>:<razorpay_signature>"` exactly as
 * `RazorpayProvider.confirm` (`modules/payments/providers/razorpay.ts`) expects to parse it. The
 * real, authoritative confirmation still happens asynchronously via the Razorpay webhook
 * (`/api/webhooks/razorpay`) calling `confirmPayment` directly — this submission is best-effort
 * notice to admins, same as the manual flow. Any other method is shown as an explicit "not
 * wired" state, never a fake success.
 */
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, type Money } from "@/lib/money";
import { submitPaymentReference } from "@/modules/payments/customer-mutations";
import type { PaymentInstructions } from "@/modules/payments/provider";
import { Banner } from "./Banner";

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-body-sm">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={mono ? "font-mono tnum text-right" : "text-right"}>{value}</dd>
    </div>
  );
}

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutInstance {
  open(): void;
  on(
    event: "payment.failed",
    handler: (response: { error?: { description?: string } }) => void,
  ): void;
}

interface RazorpayCheckoutCtor {
  new (options: {
    key: string;
    order_id: string;
    amount?: number;
    currency?: string;
    name?: string;
    description?: string;
    notes?: Record<string, string>;
    handler: (response: RazorpaySuccessResponse) => void;
    modal?: { ondismiss?: () => void };
  }): RazorpayCheckoutInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutCtor;
  }
}

/** Loads `checkout.js` once per page (idempotent — safe to call on every "Pay now" click). */
function loadRazorpayCheckoutScript(): Promise<RazorpayCheckoutCtor> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Razorpay checkout requires a browser"));
      return;
    }
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SRC}"]`,
    );
    const onLoad = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay checkout script loaded but window.Razorpay is missing"));
    };
    if (existing) {
      if (window.Razorpay) {
        resolve(window.Razorpay);
      } else {
        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load Razorpay checkout")),
          {
            once: true,
          },
        );
      }
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Razorpay checkout")), {
      once: true,
    });
    document.body.appendChild(script);
  });
}

type RazorpayFlowState = "idle" | "loading_sdk" | "opening" | "confirming" | "failed" | "cancelled";

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

  const [rzpState, setRzpState] = React.useState<RazorpayFlowState>("idle");
  const [rzpError, setRzpError] = React.useState<string | null>(null);

  const isManual = instructions.method === "manual_upi" || instructions.method === "manual_bank";
  const razorpayAmount =
    instructions.method === "razorpay"
      ? (instructions.amount as unknown as Money | undefined)
      : undefined;

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

  /** On Checkout.js success: pack the reference exactly as `RazorpayProvider.confirm` parses it
   * and submit it through the SAME `submitPaymentReference` the manual flow uses. */
  async function handleRazorpaySuccess(response: RazorpaySuccessResponse) {
    setRzpState("confirming");
    setRzpError(null);
    const packedReference = `${response.razorpay_order_id}:${response.razorpay_payment_id}:${response.razorpay_signature}`;
    const result = await submitPaymentReference({ paymentId, reference: packedReference });
    if (result.ok) {
      setSubmitted(true);
      setRzpState("idle");
      toast.success("Payment received — confirming shortly");
    } else {
      setRzpState("failed");
      setRzpError(result.error.message);
      toast.error(result.error.message);
    }
  }

  async function openRazorpayCheckout() {
    if (instructions.method !== "razorpay") return;
    setRzpError(null);
    setRzpState("loading_sdk");
    let Razorpay: RazorpayCheckoutCtor;
    try {
      Razorpay = await loadRazorpayCheckoutScript();
    } catch {
      setRzpState("failed");
      setRzpError("Couldn't load Razorpay checkout — check your connection and try again.");
      return;
    }

    const keyId = typeof instructions.keyId === "string" ? instructions.keyId : "";
    const razorpayOrderId =
      typeof instructions.razorpayOrderId === "string" ? instructions.razorpayOrderId : "";
    if (!keyId || !razorpayOrderId) {
      setRzpState("failed");
      setRzpError("This payment isn't configured correctly — please open a query for help.");
      return;
    }
    const amount = instructions.amount as unknown as Money | undefined;

    setRzpState("opening");
    const rzp = new Razorpay({
      key: keyId,
      order_id: razorpayOrderId,
      amount: amount?.amountMinor,
      currency: amount?.currency,
      name: "CodeKraft",
      description: orderNo,
      notes: { orderNo },
      handler: (response) => {
        void handleRazorpaySuccess(response);
      },
      modal: {
        ondismiss: () => {
          setRzpState((current) => (current === "opening" ? "cancelled" : current));
        },
      },
    });
    rzp.on("payment.failed", (failure) => {
      setRzpState("failed");
      setRzpError(failure.error?.description ?? "Payment failed — you can try again.");
    });
    rzp.open();
  }

  const rzpBusy = rzpState === "loading_sdk" || rzpState === "opening" || rzpState === "confirming";

  return (
    <div className="mx-auto max-w-[640px] space-y-6 rounded-xl border border-border bg-surface p-6 shadow-2 sm:p-8">
      <Banner tone="success" title={`Order ${orderNo} placed`}>
        This order is <strong>pending payment</strong>, not paid.{" "}
        {instructions.method === "razorpay"
          ? "Pay with Razorpay below — access unlocks once the payment is confirmed."
          : "Complete the transfer below, then submit your reference — we confirm manually (usually within 1 working day) and access unlocks once we do."}
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
      ) : instructions.method === "razorpay" ? (
        <section className="space-y-3">
          <h2 className="text-h4 text-fg">Pay with Razorpay</h2>
          <dl className="divide-y divide-border">
            <Row label="Amount" value={razorpayAmount ? format(razorpayAmount) : "—"} mono />
            <Row label="Order" value={orderNo} mono />
          </dl>
          {!submitted ? (
            <>
              {rzpState === "cancelled" ? (
                <Banner tone="warning" title="Payment cancelled">
                  You closed the Razorpay window before paying. No charge was made — you can try
                  again.
                </Banner>
              ) : null}
              {rzpState === "failed" ? (
                <Banner tone="danger" title="Payment failed">
                  {rzpError ?? "Something went wrong with the payment. You can try again."}
                </Banner>
              ) : null}
              <Button
                type="button"
                loading={rzpBusy}
                disabled={rzpBusy}
                onClick={() => void openRazorpayCheckout()}
              >
                {rzpState === "loading_sdk"
                  ? "Loading checkout…"
                  : rzpState === "opening"
                    ? "Opening Razorpay…"
                    : rzpState === "confirming"
                      ? "Confirming…"
                      : rzpState === "failed" || rzpState === "cancelled"
                        ? "Retry payment"
                        : "Pay now"}
              </Button>
            </>
          ) : null}
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
      ) : isManual ? (
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
      ) : null}
    </div>
  );
}
