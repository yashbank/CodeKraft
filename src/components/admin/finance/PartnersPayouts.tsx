"use client";

import Link from "next/link";
import * as React from "react";
import { InfoIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { parseMinor } from "@/lib/money";
import { ApprovalGateNotice } from "../Banner";
import { Sparkline } from "../charts/Sparkline";
import { FilterChips } from "../FilterChips";
import { formatDate, formatDateTime, initials, inr, money } from "../format";
import { MoneyCell } from "../MoneyCell";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import type { PartnerBalance, PayoutRow } from "../types";

export interface PartnersPayoutsProps {
  partners: PartnerBalance[];
  company?: { companyCutInr: number; companyExpensesInr: number; netInr: number };
  payouts: PayoutRow[];
  approvers: string[];
  isSuperAdmin: boolean;
  statementsHref: string;
  ledgerHref: string;
  approvalsHref: string;
  initialTab?: "partners" | "payouts";
}

/**
 * SCR-ADM-19 — partner balance cards (with 12-month sparkline and balance history) and the
 * payouts table. "Record payout" is dual-approved and rejects amounts above the available
 * balance with "Exceeds available balance by ₹X" (no override).
 */
export function PartnersPayouts({
  partners,
  company,
  payouts,
  approvers,
  isSuperAdmin,
  statementsHref,
  ledgerHref,
  approvalsHref,
  initialTab = "partners",
}: PartnersPayoutsProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [partnerId, setPartnerId] = React.useState(partners[0]?.id ?? "");
  const [amount, setAmount] = React.useState("");
  const [status, setStatus] = React.useState<PayoutRow["status"] | null>(null);
  const [selectedHistory, setSelectedHistory] = React.useState(partners[0]?.id ?? "");
  const partner = partners.find((p) => p.id === partnerId);
  const amountMinor = (() => {
    try {
      return parseMinor(amount || "0", "INR");
    } catch {
      return Number.NaN;
    }
  })();
  const over = partner && Number.isFinite(amountMinor) ? amountMinor - partner.balanceInr : 0;
  const rows = payouts.filter((p) => (status ? p.status === status : true));
  const historyPartner = partners.find((p) => p.id === selectedHistory);

  const openDialog = (id?: string) => {
    const p = partners.find((x) => x.id === (id ?? partnerId)) ?? partners[0];
    if (p) {
      setPartnerId(p.id);
      setAmount((p.balanceInr / 100).toFixed(2));
    }
    setDialogOpen(true);
  };

  return (
    <TooltipProvider>
      <PageHeader
        title="Partners & payouts"
        description="Payouts are recorded after you transfer the money by hand; the platform does not move money."
        actions={
          <Button size="sm" onClick={() => openDialog()}>
            <PlusIcon aria-hidden /> Record payout
          </Button>
        }
      />
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="partners">Partner balances</TabsTrigger>
          <TabsTrigger value="payouts">Payouts ({payouts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="partners" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3 tv:grid-cols-4">
            {partners.map((p) => (
              <section
                key={p.id}
                aria-label={`${p.name} balance`}
                className="space-y-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>{initials(p.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-h4">{p.name}</h2>
                    <p className="text-caption text-fg-muted">
                      {p.role}
                      {p.active ? "" : " · inactive"}
                    </p>
                  </div>
                  <Sparkline
                    points={p.sparkline}
                    label={`${p.name} 12-month allocations`}
                    series={p.id === partners[0]?.id ? 2 : 3}
                  />
                </div>
                <div>
                  <p className="flex items-center gap-1 text-overline tracking-wider text-fg-muted uppercase">
                    Balance
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button">
                          <InfoIcon aria-hidden className="size-3.5" />
                          <span className="sr-only">Definition</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        allocations − refund reversals − payouts − shared expenses (partner_balances
                        view)
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p
                    className="text-[28px] leading-tight font-semibold tnum"
                    aria-label={`${inr(p.balanceInr)} INR`}
                  >
                    {inr(p.balanceInr)}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {p.perCurrency.map((m) => (
                      <Badge key={m.currency} tone="neutral" size="sm">
                        {money(m)}
                      </Badge>
                    ))}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-body-sm">
                  <div>
                    <dt className="text-caption text-fg-muted">Earned (all time)</dt>
                    <dd className="font-mono tnum">{inr(p.earnedInr)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-fg-muted">Paid out</dt>
                    <dd className="font-mono tnum">{inr(p.paidOutInr)}</dd>
                  </div>
                </dl>
                {p.pendingPayoutApprovals > 0 ? (
                  <Badge tone="warning">{p.pendingPayoutApprovals} payout awaiting approval</Badge>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openDialog(p.id)}>
                    Record payout
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={statementsHref}>Statement</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={ledgerHref}>Ledger lines</Link>
                  </Button>
                </div>
              </section>
            ))}
            {isSuperAdmin && company ? (
              <section
                aria-label="Company"
                className="space-y-3 rounded-lg border border-border bg-surface p-4"
              >
                <h2 className="text-h4">Company</h2>
                <dl className="space-y-2 text-body-sm">
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Company cut total</dt>
                    <dd className="font-mono tnum">{inr(company.companyCutInr)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Company-only expenses</dt>
                    <dd className="font-mono tnum text-danger">
                      −{inr(company.companyExpensesInr)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>Net</dt>
                    <dd className="font-mono tnum">{inr(company.netInr)}</dd>
                  </div>
                </dl>
              </section>
            ) : null}
          </div>
          <section
            aria-labelledby="history-title"
            className="rounded-lg border border-border bg-surface"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 id="history-title" className="text-h4">
                Balance history
              </h2>
              <Select value={selectedHistory} onValueChange={setSelectedHistory}>
                <SelectTrigger size="sm" className="w-44" aria-label="Partner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableCaption className="sr-only">Balance history</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Allocations</TableHead>
                  <TableHead className="text-right">Refunds</TableHead>
                  <TableHead className="text-right">Expense share</TableHead>
                  <TableHead className="text-right">Payouts</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(historyPartner?.history ?? []).map((h) => (
                  <TableRow key={h.month}>
                    <TableCell>{h.month}</TableCell>
                    <TableCell>
                      <MoneyCell value={{ amountMinor: h.allocations, currency: "INR" }} signed />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={{ amountMinor: h.refunds, currency: "INR" }} signed />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={{ amountMinor: h.expenses, currency: "INR" }} signed />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={{ amountMinor: h.payouts, currency: "INR" }} signed />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={{ amountMinor: h.closing, currency: "INR" }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </TabsContent>
        <TabsContent value="payouts" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <FilterChips
              label="Payout status"
              chips={[
                {
                  value: "pending",
                  label: "Awaiting approval",
                  count: payouts.filter((p) => p.status === "pending").length,
                },
                {
                  value: "applied",
                  label: "Recorded",
                  count: payouts.filter((p) => p.status === "applied").length,
                },
                {
                  value: "rejected",
                  label: "Rejected",
                  count: payouts.filter((p) => p.status === "rejected").length,
                },
              ]}
              value={status}
              onChange={setStatus}
            />
            <Select>
              <SelectTrigger size="sm" className="w-40" aria-label="Partner filter">
                <SelectValue placeholder="Any partner" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border bg-surface">
            <Table>
              <TableCaption className="sr-only">Payouts</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date paid</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead>Approved by / at</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ledger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paidOn)}</TableCell>
                    <TableCell>{p.partner}</TableCell>
                    <TableCell>
                      <MoneyCell value={p.amount} />
                    </TableCell>
                    <TableCell className="font-mono text-caption">{p.reference}</TableCell>
                    <TableCell className="max-w-48 truncate text-fg-muted">
                      {p.note ?? "—"}
                      {p.rejectionReason ? (
                        <span className="block text-danger">{p.rejectionReason}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-fg-muted">{p.recordedBy}</TableCell>
                    <TableCell className="text-fg-muted">
                      {p.approvedBy
                        ? `${p.approvedBy} · ${p.approvedAt ? formatDateTime(p.approvedAt) : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {p.status === "pending" ? (
                        <Link href={approvalsHref}>
                          <StatusBadge kind="approval_requests.status" value="pending" size="sm" />
                        </Link>
                      ) : (
                        <StatusBadge
                          kind="approval_requests.status"
                          value={p.status}
                          size="sm"
                          hideIcon
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {p.ledgerSeq ? (
                        <Link
                          href={ledgerHref}
                          className="font-mono text-accent-text hover:underline"
                        >
                          {p.ledgerSeq}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Record payout</DialogTitle>
            <DialogDescription>
              Another admin must approve before this posts to the ledger (BR-13). The amount cannot
              exceed the partner&rsquo;s current balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="po-partner" label="Partner" required>
              <Select
                value={partnerId}
                onValueChange={(v) => {
                  setPartnerId(v);
                  const p = partners.find((x) => x.id === v);
                  if (p) setAmount((p.balanceInr / 100).toFixed(2));
                }}
              >
                <SelectTrigger id="po-partner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="po-currency" label="Currency">
              <Select defaultValue="INR">
                <SelectTrigger id="po-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(partner?.perCurrency ?? []).map((m) => (
                    <SelectItem key={m.currency} value={m.currency}>
                      {m.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="po-amount"
              label="Amount (INR)"
              required
              error={
                over > 0
                  ? `Exceeds available balance by ${inr(over)}`
                  : !Number.isFinite(amountMinor)
                    ? "Enter a valid amount."
                    : undefined
              }
              hint={partner ? `Available ${inr(partner.balanceInr)}` : undefined}
            >
              <Input
                id="po-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={over > 0 || !Number.isFinite(amountMinor)}
                aria-describedby="po-amount-error"
                className="text-right font-mono tnum"
              />
            </Field>
            <Field id="po-date" label="Paid on" required>
              <Input id="po-date" type="date" defaultValue="2026-09-25" />
            </Field>
            <Field id="po-ref" label="Bank reference" required>
              <Input
                id="po-ref"
                className="font-mono"
                placeholder="NEFT N…"
                required
                aria-required
              />
            </Field>
            <Field id="po-note" label="Note" optional>
              <Textarea id="po-note" rows={2} />
            </Field>
          </div>
          <p
            role="status"
            aria-live="polite"
            className="rounded-md bg-elevated px-3 py-2 text-body-sm"
          >
            After this payout: balance{" "}
            <span className="font-mono tnum">
              {partner && Number.isFinite(amountMinor)
                ? inr(Math.max(0, partner.balanceInr - amountMinor))
                : "—"}
            </span>
          </p>
          <ApprovalGateNotice approvers={approvers} what="Recording a payout" />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              disabled={over > 0 || !Number.isFinite(amountMinor) || amountMinor <= 0}
              onClick={() => {
                toast.success(`Payout approval requested from ${approvers[0]}`);
                setDialogOpen(false);
              }}
            >
              Request approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
