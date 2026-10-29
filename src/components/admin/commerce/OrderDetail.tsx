"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { CircleCheckIcon, CircleIcon, DownloadIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";

import { markDelivered, setLicenseKey } from "@/modules/delivery/admin-mutations";
import { resetDownloadCount, revokeEntitlement } from "@/modules/entitlements/admin-mutations";
import { confirmPayment, failPayment, proposeRefund } from "@/modules/payments/admin-mutations";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { ActivityTimeline } from "../ActivityTimeline";
import { ApprovalGateNotice, Banner } from "../Banner";
import { EntitlementStatusChip } from "@/components/account/EntitlementStatusChip";
import { entitlementStatus } from "@/lib/entitlement-status";
import { formatDateTime, money, percentFromBps } from "../format";

function entStatusInput(ent: NonNullable<OrderItemDetail["entitlement"]>) {
  return {
    status: ent.status,
    provisioningState: ent.provisioning ?? "n/a",
    startsAt: ent.accessStarts,
    endsAt: ent.accessEnds,
    refunded: ent.refunded,
  };
}
import { KeyValue } from "../KeyValue";
import { MoneyCell } from "../MoneyCell";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { DeliveryTaskRow, OrderDetailData, OrderItemDetail } from "../types";
import { ConfirmPaymentDialog } from "./ConfirmPaymentDialog";

export interface OrderDetailProps {
  data: OrderDetailData;
  approvers: string[];
  isSuperAdmin: boolean;
  customerHref: string;
  ledgerHref: string;
  approvalsHref: string;
  queriesHref: string;
  /** Delivery tasks raised against this order's entitlements. */
  deliveryTasks?: DeliveryTaskRow[];
}

/**
 * SCR-ADM-07 — order detail: header with split banner for project orders, Payment card with the
 * confirm dialog, Items & fulfilment with per-delivery-type entitlement panels, Ledger & invoice,
 * Timeline; side cards for customer, billing, coupon/quote and refunds (dual-approved). Below `lg`
 * only the header, Payment and Customer cards render and "Confirm payment" is the only action.
 */
export function OrderDetail({
  data,
  approvers,
  isSuperAdmin,
  customerHref,
  ledgerHref,
  approvalsHref,
  queriesHref,
  deliveryTasks = [],
}: OrderDetailProps) {
  const router = useRouter();
  const { order, payment, splitApproval } = data;
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmBusy, setConfirmBusy] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [refundAmount, setRefundAmount] = React.useState(() =>
    (order.total.amountMinor / 100).toFixed(2),
  );
  const [refundReason, setRefundReason] = React.useState("");
  const [refundQueryId, setRefundQueryId] = React.useState("");
  const [refundRevoke, setRefundRevoke] = React.useState(true);
  const [refundException, setRefundException] = React.useState(false);
  const [refundBusy, setRefundBusy] = React.useState(false);
  const [failOpen, setFailOpen] = React.useState(false);
  const [failReason, setFailReason] = React.useState("");
  const [failBusy, setFailBusy] = React.useState(false);
  const [revokeOpen, setRevokeOpen] = React.useState(false);
  const [revokeEntId, setRevokeEntId] = React.useState<string | null>(null);
  const [revokeReason, setRevokeReason] = React.useState("");

  async function handleConfirmPayment(result: {
    receivedMinor: number;
    reference: string;
    note: string;
    receivedOn: string;
    licenseKeys: Array<{ orderItemId: string; licenseKey: string }>;
  }) {
    if (!payment.paymentId) {
      toast.error("No payment record to confirm on this order yet.");
      return;
    }
    setConfirmBusy(true);
    const res = await confirmPayment({
      paymentId: payment.paymentId,
      amountReceivedMinor: result.receivedMinor,
      reference: result.reference,
      receivedOn: result.receivedOn,
      note: result.note || undefined,
      licenseKeys: result.licenseKeys.length > 0 ? result.licenseKeys : undefined,
    });
    setConfirmBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(
      res.data.invoiceNo
        ? `${order.number} marked Paid · invoice ${res.data.invoiceNo}`
        : `${order.number} marked Paid`,
    );
    setConfirmOpen(false);
    router.refresh();
  }

  async function handleFailPayment() {
    if (!payment.paymentId) {
      toast.error("No payment record to fail on this order yet.");
      return;
    }
    if (failReason.trim().length === 0) {
      toast.error("A reason is required.");
      return;
    }
    setFailBusy(true);
    const res = await failPayment({ paymentId: payment.paymentId, reason: failReason.trim() });
    setFailBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(`${order.number} payment marked failed`);
    setFailOpen(false);
    setFailReason("");
    router.refresh();
  }

  async function handleProposeRefund() {
    if (!payment.paymentId) {
      toast.error("No payment record to refund on this order.");
      return;
    }
    const amountMinor = Math.round(Number.parseFloat(refundAmount || "0") * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      toast.error("Enter a valid refund amount.");
      return;
    }
    if (refundReason.trim().length === 0) {
      toast.error("A reason is required.");
      return;
    }
    setRefundBusy(true);
    const res = await proposeRefund({
      orderId: order.id,
      paymentId: payment.paymentId,
      amountMinor,
      reason: refundReason.trim(),
      revokeEntitlements: refundRevoke,
      queryId: refundQueryId.trim() || undefined,
      policyException: refundException,
    });
    setRefundBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(`Refund approval requested from ${approvers[0] ?? "another admin"}`);
    setRefundOpen(false);
    router.refresh();
  }

  const paid = order.status === "paid" || order.status === "fulfilled";
  const splitBlocked = order.type === "project" && splitApproval?.status !== "applied";
  const primary =
    !paid && (payment.status === "submitted" || payment.status === "initiated")
      ? "confirm"
      : order.status === "paid"
        ? "fulfil"
        : null;

  return (
    <>
      <header className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-h2">{order.number}</h1>
          <StatusBadge kind="orders.type" value={order.type} />
          <StatusBadge kind="orders.status" value={order.status} />
          {payment.customerCredit ? (
            <Badge tone="info">Overpaid {money(payment.customerCredit)} · customer credit</Badge>
          ) : null}
          {payment.shortfall ? (
            <Badge tone="warning">Shortfall {money(payment.shortfall)}</Badge>
          ) : null}
          <span className="ml-auto hidden items-center gap-2 lg:flex">
            {primary === "confirm" ? (
              <Button onClick={() => setConfirmOpen(true)}>Confirm payment</Button>
            ) : null}
            {primary === "fulfil" || !paid ? (
              <Button
                disabled={!paid}
                title={paid ? undefined : "Available once the order is paid"}
                onClick={() =>
                  document
                    .getElementById("order-fulfilment")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Fulfil
              </Button>
            ) : null}
            <RowActions
              label="More order actions"
              actions={[
                {
                  label: "Mark failed",
                  onSelect: () => {
                    setFailReason("");
                    setFailOpen(true);
                  },
                  disabled: paid || !payment.paymentId,
                },
                { label: "Cancel", disabled: paid },
                { label: "Resend instructions email", disabled: paid },
                {
                  label: "Download invoice",
                  disabled: !order.invoiceNumber,
                  separatorBefore: true,
                },
                { label: "Propose refund", onSelect: () => setRefundOpen(true), disabled: !paid },
                { label: "Flag chargeback", destructive: true, disabled: !paid },
                { label: "View audit trail", separatorBefore: true },
              ]}
            />
          </span>
        </div>
        {order.type === "project" ? (
          splitApproval?.status === "applied" ? (
            <Banner tone="success">
              Split approved — payment confirmation and invoice issue are unlocked.
            </Banner>
          ) : (
            <Banner
              tone="warning"
              title={`Split awaiting approval by ${splitApproval?.approver ?? approvers[0]}`}
              action={
                <Button asChild variant="link" size="sm">
                  <Link href={approvalsHref}>Open request</Link>
                </Button>
              }
            >
              Payment confirmation and invoice issue are disabled until the project_order.split
              request is applied.
            </Banner>
          )
        ) : null}
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-fg-muted">
          <span>Placed {formatDateTime(order.placedAt)}</span>
          <Link href={customerHref} className="text-accent-text hover:underline">
            {order.customer.name} · {order.customer.email}
          </Link>
          <span className="font-mono tnum text-fg">{money(order.total)}</span>
          {order.invoiceNumber ? (
            <span className="font-mono">Invoice {order.invoiceNumber}</span>
          ) : null}
        </p>
        <div className="lg:hidden">
          {primary === "confirm" ? (
            <Button className="w-full" onClick={() => setConfirmOpen(true)}>
              Confirm payment
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {/* Payment */}
          <Card title="Payment">
            <KeyValue
              columns={3}
              items={[
                {
                  label: "Method",
                  value: (
                    <StatusBadge kind="payments.provider" value={payment.provider} size="sm" />
                  ),
                },
                { label: "Amount due", value: money(payment.due), mono: true },
                {
                  label: "Status",
                  value: <StatusBadge kind="payments.status" value={payment.status} size="sm" />,
                },
                {
                  label: "Customer reference",
                  value: payment.customerReference ?? "—",
                  mono: true,
                },
                {
                  label: "Submitted",
                  value: payment.submittedAt ? formatDateTime(payment.submittedAt) : "—",
                },
                { label: "Instructions snapshot", value: payment.instructionsSnapshot, mono: true },
                ...(payment.received
                  ? [
                      { label: "Received", value: money(payment.received), mono: true },
                      {
                        label: "Shortfall → bank charge",
                        value: payment.shortfall ? money(payment.shortfall) : "None",
                        mono: true,
                      },
                      {
                        label: "Confirmed by",
                        value: `${payment.confirmedBy ?? ""} · ${payment.confirmedAt ? formatDateTime(payment.confirmedAt) : ""}`,
                      },
                    ]
                  : []),
              ]}
            />
            {payment.previousFailed.length > 0 ? (
              <ul className="mt-3 space-y-1 text-caption text-fg-muted">
                {payment.previousFailed.map((f) => (
                  <li key={f.at}>
                    Failed {formatDateTime(f.at)} — {f.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            {!paid ? (
              <div className="mt-4 hidden gap-2 lg:flex">
                <Button onClick={() => setConfirmOpen(true)} disabled={payment.status === "failed"}>
                  Confirm payment
                </Button>
                <Button
                  variant="outline"
                  disabled={!payment.paymentId}
                  onClick={() => {
                    setFailReason("");
                    setFailOpen(true);
                  }}
                >
                  Mark failed
                </Button>
              </div>
            ) : null}
          </Card>

          {/* Items & fulfilment */}
          <Card title="Items & fulfilment" collapsedOnPhone hint="Fulfilment opens on a laptop.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="whitespace-nowrap">Ownership</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <span className="block font-medium">{it.product}</span>
                      <span className="block text-caption text-fg-muted">{it.offering}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{it.qty}</TableCell>
                    <TableCell>
                      <MoneyCell value={it.unit} />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={it.discount} />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={it.tax} />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={it.total} />
                    </TableCell>
                    <TableCell>
                      {it.ownershipVersion ? (
                        <Badge tone="ghost" size="sm">
                          {it.ownershipVersion}
                        </Badge>
                      ) : it.splitSnapshot ? (
                        <Badge tone="ghost" size="sm">
                          snapshot
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {paid ? (
              <div className="mt-4 space-y-4">
                {data.items.map((it) =>
                  it.entitlement ? (
                    <div
                      key={`ent-${it.id}`}
                      className="rounded-md border border-border bg-canvas p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-body-sm font-semibold">
                          Entitlement · {it.product}
                        </span>
                        <StatusBadge
                          kind="entitlements.delivery_type"
                          value={it.deliveryType}
                          size="sm"
                        />
                        <EntitlementStatusChip input={entStatusInput(it.entitlement)} />
                        <span className="min-w-0 text-caption text-fg-muted">
                          {entitlementStatus(entStatusInput(it.entitlement)).label}
                        </span>
                      </div>
                      <EntitlementPanel
                        item={it}
                        onRevoke={() => {
                          setRevokeEntId(it.entitlement?.id ?? null);
                          setRevokeOpen(true);
                        }}
                      />
                    </div>
                  ) : null,
                )}
              </div>
            ) : (
              <p className="mt-3 text-body-sm text-fg-muted">
                Entitlements are created when the payment is confirmed.
              </p>
            )}
            {deliveryTasks.length > 0 ? (
              <div className="mt-4 rounded-md border border-border bg-canvas p-4">
                <p className="mb-2 text-body-sm font-semibold">Delivery tasks</p>
                <ul className="space-y-1 text-body-sm">
                  {deliveryTasks.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2">
                      <StatusBadge kind="delivery_tasks.kind" value={t.kind} size="sm" />
                      <span>{t.product}</span>
                      <span className="text-fg-muted">
                        {t.status === "done" ? "done" : "open"}
                        {t.assignedTo ? ` · ${t.assignedTo}` : " · unassigned"}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/admin/entitlements"
                  className="mt-2 inline-block text-caption text-accent-text hover:underline"
                >
                  Fulfil or manage in Entitlements
                </Link>
              </div>
            ) : null}
          </Card>

          {/* Ledger & invoice */}
          <Card
            title="Ledger & invoice"
            collapsedOnPhone
            hint={
              paid
                ? `Invoice ${order.invoiceNumber ?? ""} · ${data.ledger.length} entries`
                : "Posted when the payment is confirmed"
            }
          >
            {paid ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-body">{order.invoiceNumber}</span>
                  <Button variant="outline" size="sm">
                    <DownloadIcon aria-hidden /> Download PDF
                  </Button>
                  <Button asChild variant="link" size="sm">
                    <Link href={ledgerHref}>View in ledger</Link>
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seq</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">INR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ledger
                      .filter(
                        (l) =>
                          isSuperAdmin || l.partyType !== "partner" || l.party === "Priya Nair",
                      )
                      .map((l) => (
                        <TableRow key={l.seq}>
                          <TableCell className="font-mono text-fg-muted">
                            <LockIcon aria-hidden className="mr-1 inline size-3.5 text-fg-subtle" />
                            {l.seq}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              kind="ledger_entries.entry_type"
                              value={l.type}
                              size="sm"
                            />
                          </TableCell>
                          <TableCell>{l.party}</TableCell>
                          <TableCell>
                            <MoneyCell value={l.amount} signed />
                          </TableCell>
                          <TableCell>
                            <MoneyCell
                              value={{ amountMinor: l.amountInr, currency: "INR" }}
                              signed
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {data.allocation && isSuperAdmin ? (
                  <p className="mt-3 text-body-sm text-fg-muted">
                    Allocation snapshot: Company {money(data.allocation.companyCut)} ·{" "}
                    {data.allocation.lines
                      .map((l) => `${l.partner} ${money(l.amount)} (${percentFromBps(l.bps)})`)
                      .join(" · ")}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-body-sm text-fg-muted">Posted when the payment is confirmed.</p>
            )}
          </Card>

          {/* Timeline */}
          <Card title="Timeline" collapsedOnPhone hint={`${data.timeline.length} events`}>
            <ActivityTimeline events={data.timeline} empty="No events yet" />
            {data.linkedQueries.length > 0 ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-caption text-fg-muted">Linked queries</p>
                {data.linkedQueries.map((q) => (
                  <p key={q.id} className="flex items-center gap-2 text-body-sm">
                    <Link href={queriesHref} className="text-accent-text hover:underline">
                      {q.subject}
                    </Link>
                    <StatusBadge kind="queries.status" value={q.status} size="sm" />
                    <Button asChild variant="link" size="sm">
                      <Link href={queriesHref}>Reply</Link>
                    </Button>
                  </p>
                ))}
              </div>
            ) : null}
          </Card>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <Card title="Customer">
            <KeyValue
              columns={1}
              items={[
                {
                  label: "Name",
                  value: (
                    <Link href={customerHref} className="text-accent-text hover:underline">
                      {data.customer.name}
                    </Link>
                  ),
                },
                { label: "Email", value: data.customer.email, mono: true },
                {
                  label: "Country · company",
                  value: `${data.customer.country}${data.customer.company ? ` · ${data.customer.company}` : ""}`,
                },
                { label: "GSTIN", value: data.customer.gstin ?? "—", mono: true },
                {
                  label: "Tags",
                  value: (
                    <span className="flex flex-wrap gap-1">
                      {data.customer.tags.map((t) => (
                        <Badge key={t} tone="neutral" size="sm">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  ),
                },
                { label: "Notes", value: data.customer.notes ?? "—" },
              ]}
            />
          </Card>
          <Card title="Billing snapshot" collapsedOnPhone hint={data.billing.name}>
            <KeyValue
              columns={1}
              items={[
                { label: "Bill to", value: data.billing.name },
                { label: "Address", value: data.billing.address },
                { label: "Country", value: data.billing.country },
              ]}
            />
          </Card>
          <Card
            title="Coupon / quote"
            collapsedOnPhone
            hint={data.coupon?.code ?? data.quote?.title ?? "None"}
          >
            {data.coupon ? (
              <p className="text-body-sm">
                <Badge tone="accent">{data.coupon.code}</Badge>{" "}
                <span className="text-fg-muted">discount {money(data.coupon.discount)}</span>
              </p>
            ) : data.quote ? (
              <p className="text-body-sm">Quote · {data.quote.title}</p>
            ) : (
              <p className="text-body-sm text-fg-muted">No coupon or quote.</p>
            )}
          </Card>
          <Card
            title="Refund"
            collapsedOnPhone
            hint={data.refunds.length === 0 ? "No refunds" : `${data.refunds.length} refund(s)`}
          >
            {data.refunds.length === 0 ? (
              <p className="text-body-sm text-fg-muted">
                No refunds. Only UPI/bank payments can be refunded; gateway payments are
                non-refundable.
              </p>
            ) : null}
            {data.refunds.map((r) => (
              <p key={r.id} className="flex items-center gap-2 text-body-sm">
                {money(r.amount)}{" "}
                <StatusBadge kind="approval_requests.status" value={r.status} size="sm" />{" "}
                {r.creditNote ? (
                  <span className="font-mono text-caption">{r.creditNote}</span>
                ) : null}
              </p>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setRefundOpen(true)}
              disabled={!paid}
              title="Available once the order is paid"
            >
              Propose refund
            </Button>
          </Card>
        </aside>
      </div>

      <ConfirmPaymentDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        orderNumber={order.number}
        due={payment.due}
        customerReference={payment.customerReference}
        busy={confirmBusy}
        licenseItems={data.items
          .filter((it) => it.deliveryType === "license")
          .map((it) => ({ id: it.id, product: it.product }))}
        blockedReason={
          splitBlocked
            ? "Project order: the split must be approved before payment can be confirmed."
            : undefined
        }
        onConfirm={handleConfirmPayment}
      />

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Propose refund · {order.number}</DialogTitle>
            <DialogDescription>
              Refunds are dual-approved. On approval the reversal entries post, a credit note is
              issued and entitlements are revoked if selected.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="rf-amount" label={`Amount (≤ ${money(order.total)})`} required>
              <Input
                id="rf-amount"
                inputMode="decimal"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="text-right font-mono tnum"
              />
            </Field>
            <Field id="rf-query" label="Related query" optional>
              <Input
                id="rf-query"
                placeholder="Query id"
                value={refundQueryId}
                onChange={(e) => setRefundQueryId(e.target.value)}
              />
            </Field>
            <Field id="rf-reason" label="Reason" required className="sm:col-span-2">
              <Textarea
                id="rf-reason"
                rows={2}
                required
                aria-required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="rf-revoke" checked={refundRevoke} onCheckedChange={setRefundRevoke} />
            <Label htmlFor="rf-revoke">Revoke entitlements</Label>
          </div>
          {!data.refundable ? (
            <div className="flex items-start gap-2">
              <Checkbox
                id="rf-exception"
                checked={refundException}
                onCheckedChange={(v) => setRefundException(v === true)}
              />
              <Label htmlFor="rf-exception" className="leading-snug">
                Policy exception — this product is not refundable
              </Label>
            </div>
          ) : null}
          <ApprovalGateNotice approvers={approvers} what="Refunding" />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleProposeRefund} disabled={refundBusy}>
              Request approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failOpen} onOpenChange={setFailOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Mark payment failed · {order.number}</DialogTitle>
            <DialogDescription>
              The order stays pending_payment so the customer can retry.
            </DialogDescription>
          </DialogHeader>
          <Field id="fail-reason" label="Reason" required>
            <Textarea
              id="fail-reason"
              rows={2}
              required
              aria-required
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleFailPayment} disabled={failBusy}>
              Mark failed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke access for {order.number}?</DialogTitle>
            <DialogDescription>
              Downloads and keys are revoked automatically; external SaaS accounts create a revoke
              task for a human.
            </DialogDescription>
          </DialogHeader>
          <Field id="rv-reason" label="Reason" required>
            <Textarea
              id="rv-reason"
              rows={2}
              required
              aria-required
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={!revokeEntId || revokeReason.trim().length < 3}
              onClick={async () => {
                if (!revokeEntId) return;
                const r = await revokeEntitlement({
                  entitlementId: revokeEntId,
                  reason: revokeReason.trim(),
                });
                if (!r.ok) {
                  toast.error(r.error.message);
                  return;
                }
                toast.success("Access revoked");
                setRevokeOpen(false);
                setRevokeReason("");
                router.refresh();
              }}
            >
              Revoke access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Card({
  title,
  children,
  collapsedOnPhone = false,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  collapsedOnPhone?: boolean;
  hint?: string;
}) {
  return (
    <section
      id={title === "Items & fulfilment" ? "order-fulfilment" : undefined}
      aria-label={title}
      className="scroll-mt-20 rounded-lg border border-border bg-surface p-4 lg:p-5"
    >
      <h2 className="mb-3 text-h4">{title}</h2>
      {collapsedOnPhone ? (
        <>
          <p className="text-body-sm text-fg-muted lg:hidden">
            {hint ?? "Open on a laptop."}
            {hint ? " · Open on a laptop." : ""}
          </p>
          <div className="hidden lg:block">{children}</div>
        </>
      ) : (
        children
      )}
    </section>
  );
}

function EntitlementPanel({
  item,
  onRevoke,
}: {
  item: OrderDetailData["items"][number];
  onRevoke: () => void;
}) {
  const ent = item.entitlement;
  const router = useRouter();
  const [key, setKey] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (!ent) return null;
  const steps = ent.steps ?? [];
  const done = steps.filter((s) => s.done).length;
  // Every control calls the same action the Entitlements screen uses.
  const run = async (
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
    okMsg: string,
  ) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error?.message ?? "Failed");
      return;
    }
    toast.success(okMsg);
    router.refresh();
  };
  return (
    <div className="space-y-3 text-body-sm">
      {item.deliveryType === "download" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Downloads{" "}
            <span className="font-mono tnum">
              {ent.downloadsUsed ?? 0}/{ent.downloadCap ?? "∞"}
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(() => resetDownloadCount({ entitlementId: ent.id }), "Download count reset")
            }
          >
            Reset count
          </Button>
        </div>
      ) : null}
      {item.deliveryType === "license" ? (
        <Field
          id={`key-${item.id}`}
          label="License key"
          hint="Customer is notified with a link to the dashboard only — the key is never in the email."
        >
          <div className="flex gap-2">
            <Input
              id={`key-${item.id}`}
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={ent.keyIssued ? "Issued — enter a new key to rotate" : ""}
              className="w-64 font-mono"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || key.trim().length < 8}
              onClick={() =>
                run(
                  () =>
                    setLicenseKey({
                      entitlementId: ent.id,
                      licenseKey: key.trim(),
                      notifyEmail: true,
                    }),
                  "Licence key saved",
                ).then(() => setKey(""))
              }
            >
              {ent.keyIssued ? "Rotate key" : "Save"}
            </Button>
          </div>
        </Field>
      ) : null}
      {item.deliveryType === "saas" || item.deliveryType === "hosted" ? (
        <p className="text-caption text-fg-muted">
          {ent.provisioning === "done"
            ? "Provisioned."
            : "Set it up, then mark it delivered to notify the customer."}
        </p>
      ) : null}
      {item.deliveryType === "service" ? (
        <div className="space-y-2">
          <Progress
            value={steps.length ? (done / steps.length) * 100 : 0}
            aria-label="Checklist progress"
            aria-valuetext={`${done} of ${steps.length} steps`}
          />
          <ul className="space-y-1">
            {steps.map((s) => (
              <li key={s.title} className="flex h-11 items-center gap-3">
                {s.done ? (
                  <CircleCheckIcon aria-hidden className="size-4 text-success" />
                ) : (
                  <CircleIcon aria-hidden className="size-4 text-fg-subtle" />
                )}
                <span className="flex-1">{s.title}</span>
                <span className="text-caption text-fg-muted">
                  {s.done ? `${s.doneBy} · ${s.doneAt ? formatDateTime(s.doneAt) : ""}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {item.deliveryType === "custom" ||
      ((item.deliveryType === "saas" || item.deliveryType === "hosted") &&
        ent.provisioning !== "done") ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || ent.status === "revoked" || ent.provisioning === "done"}
          onClick={() => run(() => markDelivered({ entitlementId: ent.id }), "Marked delivered")}
        >
          Mark delivered
        </Button>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={onRevoke} disabled={ent.status === "revoked"}>
          Revoke access
        </Button>
      </div>
    </div>
  );
}
