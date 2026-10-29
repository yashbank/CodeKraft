"use client";

/**
 * "Confirming your payment" (R9-06). Shown right after a payment/reference is submitted and on
 * reload. Polls the order status, shows it live (aria-live), and 2.5 s after the first known
 * status moves the customer to their invoices page. Never throws or links back to the product:
 * a failed poll just shows "Couldn't check yet" and keeps the Refresh button.
 */
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { usePolling, type PollOutcome } from "@/lib/use-polling";
import { nextStep, type ConfirmStatus } from "@/lib/account/payment-confirm";
import { getPaymentConfirmStatus } from "@/modules/orders/customer-mutations";

const POLL_MS = 1500;
const REDIRECT_MS = 2500;
const INVOICES = "/account/invoices";

const LABEL = {
  pending: "Pending verification — we're checking your payment.",
  paid: "Paid — thank you!",
  failed: "Payment failed or was cancelled. You can retry from your orders.",
} as const;

export function PaymentConfirmingScreen({ orderNo }: { orderNo: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<ConfirmStatus | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [error, setError] = React.useState(false);

  const check = React.useCallback(async (): Promise<PollOutcome> => {
    setChecking(true);
    let outcome: PollOutcome = "ok";
    try {
      const r = await getPaymentConfirmStatus(orderNo);
      if (r.ok) setStatus(r.data);
      setError(!r.ok);
      if (!r.ok) outcome = "error";
    } catch {
      setError(true);
      outcome = "error";
    }
    setChecking(false);
    return outcome;
  }, [orderNo]);

  React.useEffect(() => {
    void check();
  }, [check]);
  usePolling(check, { intervalMs: POLL_MS });

  // Paid stays put so the delivery action is reachable; pending/failed hand off to invoices.
  const known = !!status && status.stage !== "paid";
  React.useEffect(() => {
    if (!known) return;
    const t = setTimeout(() => router.replace(INVOICES), REDIRECT_MS);
    return () => clearTimeout(t);
  }, [known, router]);

  const step = status?.stage === "paid" ? nextStep(status) : null;

  return (
    <section
      className="mx-auto max-w-xl space-y-4 rounded-lg border border-border bg-surface p-5"
      data-testid="payment-confirming"
    >
      <h1 className="text-h3 font-semibold text-fg">Confirming your payment</h1>
      <p className="text-body-sm text-fg-muted">Order {orderNo}</p>
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-body text-fg">
        {checking && !status ? (
          <Loader2Icon aria-hidden className="size-4 motion-safe:animate-spin" />
        ) : null}
        {status
          ? LABEL[status.stage]
          : error
            ? "Couldn't check yet — use Refresh."
            : "Checking your payment…"}
      </p>
      {known ? <p className="text-caption text-fg-muted">Taking you to your invoices…</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {step ? (
          <Button size="lg" asChild>
            <Link href={step.href}>{step.label}</Link>
          </Button>
        ) : null}
        <Button size="lg" variant="secondary" onClick={() => void check()} disabled={checking}>
          <RefreshCwIcon aria-hidden className={checking ? "motion-safe:animate-spin" : ""} />
          Refresh
        </Button>
        <Button size="lg" variant="ghost" asChild>
          <Link href={INVOICES}>Go to invoices</Link>
        </Button>
      </div>
    </section>
  );
}
