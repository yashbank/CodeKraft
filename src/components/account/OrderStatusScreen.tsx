"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  FileTextIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { format } from "@/lib/money";
import { Banner } from "./Banner";
import { PaymentMethodChoice } from "./CheckoutScreen";
import { ConfirmDialog } from "./ConfirmDialog";
import { formatDate, formatDateTime, timeUntil } from "./format";
import { PaymentInstructionsPanel } from "./PaymentInstructionsPanel";
import type { OrderView, PaymentProvider } from "./types";

const METHOD_LABEL = { manual_upi: "UPI", manual_bank: "Bank transfer" } as const;

type Stage =
  | "awaiting_reference"
  | "submitted"
  | "failed_attempt"
  | "paid"
  | "expired"
  | "cancelled"
  | "refunded";

export function orderStage(o: OrderView): Stage {
  switch (o.status) {
    case "pending_payment":
      if (o.payment?.status === "submitted") return "submitted";
      if (o.payment?.status === "failed") return "failed_attempt";
      return "awaiting_reference";
    case "paid":
    case "fulfilled":
      return "paid";
    case "failed":
      return "expired";
    case "cancelled":
      return "cancelled";
    default:
      return "refunded";
  }
}

/** Status timeline: Placed → Paid → Confirmed by us → Access ready, terminal branches rendered in red. */
function Timeline({ order: o, stage }: { order: OrderView; stage: Stage }) {
  const steps = ["Placed", "Paid", "Confirmed by us", "Access ready"];
  const reached =
    stage === "paid" ? (o.status === "fulfilled" ? 4 : 3) : stage === "submitted" ? 2 : 1;
  const terminal =
    stage === "expired"
      ? "Expired"
      : stage === "cancelled"
        ? "Cancelled"
        : stage === "refunded"
          ? o.status === "partially_refunded"
            ? "Partially refunded"
            : "Refunded"
          : null;
  return (
    <ol
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0"
      aria-label="Order progress"
    >
      {steps.map((s, i) => {
        const done = i < reached && !terminal;
        const current = i === reached - 1 && !terminal;
        return (
          <li
            key={s}
            className="flex items-center gap-2 sm:flex-1"
            aria-current={current ? "step" : undefined}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold",
                done
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border-strong text-fg-muted",
              )}
            >
              {done && !current ? <CheckIcon className="size-4" /> : i + 1}
            </span>
            <span className={cn("text-body-sm", done ? "font-semibold text-fg" : "text-fg-muted")}>
              {s}
              <span className="sr-only">{done ? " — done" : ""}</span>
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "mx-3 hidden h-0.5 flex-1 sm:block",
                  i < reached - 1 && !terminal ? "bg-accent" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
      {terminal ? (
        <li className="flex items-center gap-2 sm:ml-3" aria-current="step">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-danger text-danger-fg"
          >
            <XIcon className="size-4" />
          </span>
          <span className="text-body-sm font-semibold text-danger">{terminal}</span>
        </li>
      ) : null}
    </ol>
  );
}

/** "Open a query" / "Request refund" both create a query with `source='order'`. */
function RefundDialog({ order: o }: { order: OrderView }) {
  const [note, setNote] = React.useState("");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Request refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request refund · {o.number}</DialogTitle>
          <DialogDescription>
            {o.refundable
              ? "This product is refundable within our policy. We'll review and reply within one working day."
              : "This product is non-refundable; you can still ask and we'll review."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="refund-note">Tell us why (optional)</Label>
          <Textarea
            id="refund-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={4000}
          />
          <p className="text-caption text-fg-muted">
            Opens a query "Refund request · {o.number}" with the amount {format(o.total)}. See the{" "}
            <Link href="/legal/refunds" className="text-accent-text underline">
              refund policy
            </Link>
            .
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              onClick={() =>
                toast.success("Query created", { description: `Refund request · ${o.number}` })
              }
            >
              Send request
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SCR-ACC-11 — order status: header with chip + expiry countdown, timeline, stage panel (7/12) and
 * order summary (5/12). Stages: awaiting reference (QR/bank + reference form), submitted,
 * failed attempt (retry → method chooser), paid/fulfilled, expired/cancelled, refunded.
 */
export function OrderStatusScreen({
  order: o,
  now,
  links,
  loading = false,
}: {
  order: OrderView;
  now: string;
  links: { purchases: string; entitlement?: string; newQuery: string; product: string };
  loading?: boolean;
}) {
  const stage = orderStage(o);
  const [method, setMethod] = React.useState<PaymentProvider>(o.paymentMethod);
  const [reference, setReference] = React.useState(o.payment?.reference ?? "");
  const [retrying, setRetrying] = React.useState(false);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const expiresIn = o.expiresAt ? timeUntil(o.expiresAt, now) : null;

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-24" />
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-80 lg:col-span-7" />
          <Skeleton className="h-80 lg:col-span-5" />
        </div>
      </div>
    );
  }

  const referenceForm = (
    <form
      className="space-y-4 rounded-lg border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        toast.success("Reference submitted", {
          description: "We'll confirm within 1 working day.",
        });
      }}
    >
      <h3 className="text-body font-semibold text-fg">
        After paying, enter the UTR / transaction reference
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="utr" required>
            Transaction reference / UTR
          </Label>
          <Input
            id="utr"
            className="font-mono"
            minLength={6}
            maxLength={64}
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            aria-describedby="utr-help"
          />
          <p id="utr-help" className="text-caption text-fg-muted">
            The UTR or transaction ID from your UPI app or bank statement.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="paid-on">Paid on</Label>
          <Input id="paid-on" type="date" defaultValue={now.slice(0, 10)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-note">Note (optional)</Label>
          <Input id="pay-note" />
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={reference.trim().length < 6}>
          I&apos;ve paid — submit reference
        </Button>
        {o.enabledMethods.length > 1 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMethod(method === "manual_upi" ? "manual_bank" : "manual_upi")}
          >
            Switch to {method === "manual_upi" ? "bank transfer" : "UPI"}
          </Button>
        ) : null}
        <ConfirmDialog
          trigger={
            <Button type="button" variant="ghost" className="text-danger hover:text-danger">
              Cancel order
            </Button>
          }
          title={`Cancel order ${o.number}?`}
          description="If you've already paid, don't cancel — submit your reference instead. Cancelling can't be undone."
          confirmLabel="Cancel order"
          onConfirm={() => toast("Order cancelled")}
        />
      </div>
    </form>
  );

  let panel: React.ReactNode;
  switch (stage) {
    case "awaiting_reference":
      panel = (
        <>
          <div className="rounded-lg border border-border bg-surface p-4">
            <PaymentInstructionsPanel
              instructions={o.instructionsFor}
              methods={o.enabledMethods}
              method={method}
              onMethodChange={setMethod}
              amount={o.total}
              orderNumber={o.number}
            />
          </div>
          {referenceForm}
        </>
      );
      break;
    case "submitted":
      panel = (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <CircleCheckIcon aria-hidden className="mt-0.5 size-6 shrink-0 text-success" />
            <div className="space-y-1">
              <p className="text-body font-semibold text-fg">
                Reference received: <span className="font-mono">{o.payment?.reference}</span>
              </p>
              <p className="text-body-sm text-fg-muted">
                We&apos;re confirming your payment — usually within 1 working day. You&apos;ll get
                an email.
              </p>
            </div>
          </div>
          <Banner tone="info">We confirm payments manually within one business day.</Banner>
          <Button variant="secondary" size="sm">
            Edit reference
          </Button>
        </div>
      );
      break;
    case "failed_attempt":
      panel = retrying ? (
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <h3 className="text-body font-semibold text-fg">Choose how to pay</h3>
            <PaymentMethodChoice methods={o.enabledMethods} value={method} onChange={setMethod} />
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <PaymentInstructionsPanel
              instructions={o.instructionsFor}
              methods={[method]}
              method={method}
              amount={o.total}
              orderNumber={o.number}
            />
          </div>
          {referenceForm}
        </div>
      ) : (
        <Banner
          tone="danger"
          title="Payment attempt failed"
          action={
            <Button size="sm" onClick={() => setRetrying(true)}>
              Retry payment
            </Button>
          }
        >
          {o.payment?.failureReason ?? "We couldn't match a payment to this order."} Your order
          stays open until {o.expiresAt ? formatDate(o.expiresAt) : "it expires"}.
        </Banner>
      );
      break;
    case "paid":
      panel = (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <CircleCheckIcon aria-hidden className="mt-0.5 size-6 shrink-0 text-success" />
            <div className="space-y-1">
              <p className="text-body font-semibold text-fg">
                Payment confirmed on{" "}
                {o.payment?.confirmedAt ? formatDateTime(o.payment.confirmedAt) : "—"}
              </p>
              {o.payment?.received ? (
                <p className="text-body-sm text-fg-muted">
                  {o.payment.shortfall && o.payment.shortfall.amountMinor > 0
                    ? `We received ${format(o.payment.received)} against ${format(o.total)}; the bank charge was absorbed by us — nothing more to pay.`
                    : `Received ${format(o.payment.received)} via ${METHOD_LABEL[o.paymentMethod]}.`}
                </p>
              ) : null}
            </div>
          </div>
          {o.postPurchaseInstructions?.length ? (
            <div className="space-y-2 rounded-md bg-canvas p-4 text-body-sm text-fg-muted">
              {o.postPurchaseInstructions.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            {links.entitlement ? (
              <Button size="lg" asChild>
                <Link href={links.entitlement}>Go to your purchase</Link>
              </Button>
            ) : null}
            <Button size="lg" variant="secondary">
              <FileTextIcon aria-hidden /> Download invoice
            </Button>
          </div>
        </div>
      );
      break;
    case "expired":
    case "cancelled":
      panel = (
        <Banner
          tone="neutral"
          title={
            stage === "expired"
              ? `This order expired on ${o.expiresAt ? formatDate(o.expiresAt) : "—"}`
              : "You cancelled this order"
          }
          action={
            <Button size="sm" asChild>
              <Link href={links.product}>Buy again</Link>
            </Button>
          }
        >
          {stage === "expired"
            ? "Unpaid orders are cancelled automatically after 7 days (no charge was made)."
            : "Nothing was charged."}
        </Banner>
      );
      break;
    default:
      panel = (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
          <p className="text-body font-semibold text-fg">
            {o.status === "partially_refunded" ? "Partially refunded" : "Refunded"}:{" "}
            {o.refund ? format(o.refund.amount) : "—"}
          </p>
          {o.refund ? (
            <p className="text-body-sm text-fg-muted">
              Credit note{" "}
              <span className="font-mono text-accent-text">{o.refund.creditNoteNumber}</span> is in
              Invoices &amp; payments.
              {o.refund.revokedAt
                ? ` Access was revoked on ${formatDate(o.refund.revokedAt)}.`
                : ""}
            </p>
          ) : null}
        </div>
      );
  }

  const summary = (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-1">
      <h2 className="text-h4 text-fg">Order summary</h2>
      <ul className="space-y-2 text-body-sm">
        {o.lines.map((l) => (
          <li key={l.name} className="flex justify-between gap-3">
            <span className="text-fg">{l.name}</span>
            <span className="font-mono tnum text-fg">{format(l.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-1.5 border-t border-border pt-3 text-body-sm">
        <div className="flex justify-between">
          <dt className="text-fg-muted">Subtotal</dt>
          <dd className="font-mono tnum">{format(o.subtotal)}</dd>
        </div>
        {o.discount ? (
          <div className="flex justify-between text-success">
            <dt>Discount ({o.discount.code})</dt>
            <dd className="font-mono tnum">−{format(o.discount.amount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-fg-muted">Tax</dt>
          <dd className="font-mono tnum">{o.tax ? format(o.tax) : "No tax"}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-body font-semibold text-fg">
          <dt>Total</dt>
          <dd className="font-mono tnum">{format(o.total)}</dd>
        </div>
        {o.displayTotal ? (
          <div className="flex justify-between text-caption text-fg-muted">
            <dt>≈ estimate</dt>
            <dd className="font-mono tnum">≈ {format(o.displayTotal)}</dd>
          </div>
        ) : null}
      </dl>
      <div className="border-t border-border pt-3 text-body-sm">
        <p className="text-caption text-fg-muted">Billing</p>
        <p className="text-fg">
          {o.billing.name}
          {o.billing.company ? ` · ${o.billing.company}` : ""}
        </p>
        <p className="text-fg-muted">
          {[o.billing.line1, o.billing.city, o.billing.country].filter(Boolean).join(", ")}
        </p>
        {o.billing.gstNumber ? (
          <p className="font-mono text-caption text-fg-muted">GSTIN {o.billing.gstNumber}</p>
        ) : null}
        <p className="mt-2 text-caption text-fg-muted">
          Payment method: {METHOD_LABEL[o.paymentMethod]}. Billing details can&apos;t change after
          placement.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-body-sm text-fg-muted">
          <li>
            <Link href={links.purchases} className="hover:text-fg">
              Purchases
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <ChevronRightIcon aria-hidden className="size-3.5" />
            <span aria-current="page" className="font-mono font-medium text-fg">
              {o.number}
            </span>
          </li>
        </ol>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1 text-fg">Order {o.number}</h1>
          <StatusBadge kind="orders.status" value={o.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-fg-muted">
          <span>Placed {formatDateTime(o.placedAt)}</span>
          {o.status === "pending_payment" && expiresIn ? (
            <span className="font-medium text-warning">Pay within {expiresIn}</span>
          ) : null}
        </p>
        <Timeline order={o} stage={stage} />
      </header>

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-body-sm font-semibold text-fg lg:hidden"
        aria-expanded={summaryOpen}
        aria-controls="order-summary"
        onClick={() => setSummaryOpen((s) => !s)}
      >
        Order summary · {format(o.total)}
        <ChevronDownIcon
          aria-hidden
          className={cn("size-4 transition-transform", summaryOpen && "rotate-180")}
        />
      </button>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          {panel}
          <div className="flex flex-wrap items-center gap-2 text-body-sm text-fg-muted">
            Need help with this order?
            <Button variant="link" size="sm" asChild>
              <Link href={links.newQuery}>Open a query</Link>
            </Button>
            {stage === "paid" ? <RefundDialog order={o} /> : null}
          </div>
        </div>
        <aside
          id="order-summary"
          className={cn("lg:col-span-5 lg:block", summaryOpen ? "block" : "hidden")}
        >
          {summary}
        </aside>
      </div>
    </div>
  );
}
