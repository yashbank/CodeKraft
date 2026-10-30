"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
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
import { parseMinor, type Currency } from "@/lib/money";
import { recordPayout } from "@/modules/finance/admin-mutations";
import { createPartner, ensureSuperAdminPartners } from "@/modules/users/admin-mutations";
import {
  isTempId,
  mergeOptimistic,
  optimisticReducer,
  TEMP_ID_PREFIX,
} from "@/lib/admin/optimistic-rows";
import { ApprovalGateNotice } from "../Banner";
import { SuccessMark } from "../SuccessMark";
import { Sparkline } from "../charts/Sparkline";
import { FilterChips } from "../FilterChips";
import { filterPayoutRows } from "@/lib/admin/finance-filters";
import { useUrlFilters } from "./use-url-filters";
import { formatDate, formatDateTime, initials, inr, money } from "../format";
import { MoneyCell } from "../MoneyCell";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import type { PartnerBalance, PayoutRow } from "../types";
import { isoDate } from "@/lib/dates";

export interface PartnersPayoutsProps {
  partners: PartnerBalance[];
  company?: { companyCutInr: number; companyExpensesInr: number; netInr: number };
  payouts: PayoutRow[];
  approvers: string[];
  isSuperAdmin: boolean;
  /** Admin-class users without a partner row yet (the "Add partner" picker). */
  candidates?: Array<{ userId: string; name: string; email: string }>;
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
  candidates = [],
  statementsHref,
  ledgerHref,
  approvalsHref,
  initialTab = "partners",
}: PartnersPayoutsProps) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [partnerId, setPartnerId] = React.useState(partners[0]?.id ?? "");
  const [currency, setCurrency] = React.useState<Currency>("INR");
  const [amount, setAmount] = React.useState("");
  const uf = useUrlFilters();
  const status = (uf.get("status") || null) as PayoutRow["status"] | null;
  const setStatus = (v: PayoutRow["status"] | null) => uf.set("status", v ?? "");
  const [selectedHistory, setSelectedHistory] = React.useState(partners[0]?.id ?? "");
  const [addOpen, setAddOpen] = React.useState(false);
  const [addUserId, setAddUserId] = React.useState("");
  const [addEmail, setAddEmail] = React.useState("");
  const [addName, setAddName] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [addDone, setAddDone] = React.useState(false);
  // Synchronous guard: two fast clicks can both pass a `disabled` state check.
  const addLock = React.useRef(false);
  const [pendingCards, dispatch] = React.useReducer(optimisticReducer<PartnerBalance>, []);
  const cards = mergeOptimistic(partners, pendingCards);
  React.useEffect(() => {
    if (!addDone) return;
    const t = setTimeout(() => {
      setAddOpen(false);
      setAddDone(false);
    }, 1000);
    return () => clearTimeout(t);
  }, [addDone]);
  const [backfilling, setBackfilling] = React.useState(false);
  const partner = partners.find((p) => p.id === partnerId);
  const amountMinor = (() => {
    try {
      return parseMinor(amount || "0", currency);
    } catch {
      return Number.NaN;
    }
  })();
  const over = partner && Number.isFinite(amountMinor) ? amountMinor - partner.balanceInr : 0;
  const rows = filterPayoutRows(payouts, {
    status: status ?? undefined,
    partner: partners.find((p) => p.id === uf.get("partner"))?.name,
  });
  const historyPartner = partners.find((p) => p.id === selectedHistory);

  const openDialog = (id?: string) => {
    const p = partners.find((x) => x.id === (id ?? partnerId)) ?? partners[0];
    if (p) {
      setPartnerId(p.id);
      setCurrency(p.perCurrency[0]?.currency ?? "INR");
      setAmount((p.balanceInr / 100).toFixed(2));
    }
    setDialogOpen(true);
  };

  async function handleSubmit() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const paidOn = String(fd.get("paidOn") ?? "");
    const reference = String(fd.get("reference") ?? "").trim();
    const note = String(fd.get("note") ?? "").trim();
    if (!paidOn) {
      toast.error("Pick the date the payout was paid on.");
      return;
    }
    if (reference.length < 1) {
      toast.error("Enter a bank / UPI reference.");
      return;
    }
    setSubmitting(true);
    const result = await recordPayout({
      partnerId,
      amountMinor,
      currency,
      paidOn,
      reference,
      note: note || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Payout sent for approval");
    setDialogOpen(false);
    router.refresh();
  }

  async function handleAddPartner() {
    if (addLock.current) return;
    const email = addEmail.trim();
    if (!addUserId && !email) {
      toast.error("Pick an admin user or enter their email.");
      return;
    }
    addLock.current = true;
    setAdding(true);
    // Optimistic card: shown now, re-keyed to the partner id on success, removed on failure.
    const picked = candidates.find((c) => c.userId === addUserId);
    const tempId = `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
    dispatch({
      type: "add",
      row: {
        id: tempId,
        name: addName.trim() || picked?.name || picked?.email || email,
        role: "Partner",
        active: true,
        balanceInr: 0,
        perCurrency: [],
        earnedInr: 0,
        paidOutInr: 0,
        pendingPayoutApprovals: 0,
        sparkline: [],
        history: [],
      },
    });
    const result = await createPartner({
      ...(addUserId ? { userId: addUserId } : { email }),
      ...(addName.trim() ? { displayName: addName.trim() } : {}),
    });
    addLock.current = false;
    setAdding(false);
    if (!result.ok) {
      dispatch({ type: "rollback", tempId });
      toast.error(result.error.message);
      return;
    }
    dispatch({
      type: "settle",
      tempId,
      id: result.data.partner.id,
      patch: { name: result.data.partner.displayName },
    });
    toast.success(`${result.data.partner.displayName} added as a partner`);
    setAddDone(true);
    setAddUserId("");
    setAddEmail("");
    setAddName("");
    router.refresh();
  }

  async function handleBackfill() {
    setBackfilling(true);
    const result = await ensureSuperAdminPartners();
    setBackfilling(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    const n = result.data.created.length;
    toast.success(
      n === 0
        ? "Every super admin already has a partner row."
        : `Added ${n} super admin${n === 1 ? "" : "s"} as partner${n === 1 ? "" : "s"}.`,
    );
    router.refresh();
  }

  return (
    <TooltipProvider>
      <PageHeader
        title="Partners & payouts"
        description="Payouts are recorded after you transfer the money by hand; the platform does not move money."
        actions={
          <div className="flex flex-wrap gap-2">
            {isSuperAdmin ? (
              <Button
                size="sm"
                variant="outline"
                disabled={backfilling}
                onClick={() => {
                  void handleBackfill();
                }}
              >
                Add super admins as partners
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
              <PlusIcon aria-hidden /> Add partner
            </Button>
            <Button size="sm" disabled={partners.length === 0} onClick={() => openDialog()}>
              <PlusIcon aria-hidden /> Record payout
            </Button>
          </div>
        }
      />
      <Tabs defaultValue={uf.active(["status", "partner"]) ? "payouts" : initialTab}>
        <TabsList>
          <TabsTrigger value="partners">Partner balances</TabsTrigger>
          <TabsTrigger value="payouts">Payouts ({payouts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="partners" className="space-y-6">
          {cards.length === 0 ? (
            <section
              aria-label="No partners"
              className="rounded-lg border border-dashed border-border bg-surface p-8 text-center"
            >
              <h2 className="text-h4">No partners yet</h2>
              <p className="mx-auto mt-1 max-w-md text-body-sm text-fg-muted">
                Partners hold ownership shares in products and receive payouts. Add an admin user as
                a partner, then set their share on each product&rsquo;s ownership tab.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <PlusIcon aria-hidden /> Add partner
                </Button>
                {isSuperAdmin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={backfilling}
                    onClick={() => {
                      void handleBackfill();
                    }}
                  >
                    Add super admins as partners
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-3 tv:grid-cols-4">
            {cards.map((p) => (
              <section
                key={p.id}
                aria-label={`${p.name} balance`}
                className={`space-y-3 rounded-lg border border-border bg-surface p-4${isTempId(p.id) ? " ck-row-added" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>{initials(p.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-h4" title={p.name}>
                      {p.name}
                    </h2>
                    <p className="text-caption text-fg-muted">
                      {p.role}
                      {p.active ? "" : " · inactive"}
                    </p>
                  </div>
                  <Sparkline
                    points={p.sparkline}
                    label={`${p.name} 12-month allocations`}
                    series={p.id === cards[0]?.id ? 2 : 3}
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
                  <Button
                    size="sm"
                    disabled={!partners.some((x) => x.id === p.id)}
                    onClick={() => openDialog(p.id)}
                  >
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
          {partners.length > 0 ? (
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
                  {(historyPartner?.history ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-fg-muted">
                        No ledger activity for this partner yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
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
          ) : null}
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
            {partners.length > 0 ? (
              <Select
                value={uf.get("partner") || "all"}
                onValueChange={(v) => uf.set("partner", v)}
              >
                <SelectTrigger size="sm" className="w-40" aria-label="Partner filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any partner</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
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
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-fg-muted">
                      No payouts recorded yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paidOn)}</TableCell>
                    <TableCell>{p.partner}</TableCell>
                    <TableCell>
                      <MoneyCell value={p.amount} />
                    </TableCell>
                    <TableCell className="font-mono text-caption">{p.reference}</TableCell>
                    <TableCell className="max-w-48 text-fg-muted">
                      <span className="block truncate" title={p.note ?? undefined}>
                        {p.note ?? "—"}
                      </span>
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

      <Dialog open={addOpen} onOpenChange={(o) => (adding ? undefined : setAddOpen(o))}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Add partner</DialogTitle>
            <DialogDescription>
              A partner is an admin user who can hold product shares and receive payouts. Set their
              share on the product&rsquo;s ownership tab afterwards.
            </DialogDescription>
          </DialogHeader>
          {addDone ? (
            <SuccessMark>Partner added</SuccessMark>
          ) : (
            <div className="grid gap-4">
              {candidates.length > 0 ? (
                <Field id="ap-user" label="Admin user">
                  <Select
                    value={addUserId}
                    onValueChange={(v) => {
                      setAddUserId(v);
                      setAddEmail("");
                    }}
                  >
                    <SelectTrigger id="ap-user">
                      <SelectValue placeholder="Pick an admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((c) => (
                        <SelectItem key={c.userId} value={c.userId}>
                          {c.name ? `${c.name} · ${c.email}` : c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              <Field
                id="ap-email"
                label={candidates.length > 0 ? "Or admin email" : "Admin email"}
                hint="Must already be an admin user."
              >
                <Input
                  id="ap-email"
                  type="email"
                  value={addEmail}
                  onChange={(e) => {
                    setAddEmail(e.target.value);
                    if (e.target.value) setAddUserId("");
                  }}
                />
              </Field>
              <Field id="ap-name" label="Display name" optional>
                <Input id="ap-name" value={addName} onChange={(e) => setAddName(e.target.value)} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={adding}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              loading={adding}
              disabled={addDone || (!addUserId && !addEmail.trim())}
              onClick={() => {
                void handleAddPartner();
              }}
            >
              Add partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Record payout</DialogTitle>
            <DialogDescription>
              Another admin must approve before this posts to the ledger. The amount cannot exceed
              the partner&rsquo;s current balance.
            </DialogDescription>
          </DialogHeader>
          <form
            ref={formRef}
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => e.preventDefault()}
          >
            <Field id="po-partner" label="Partner" required>
              <Select
                value={partnerId}
                onValueChange={(v) => {
                  setPartnerId(v);
                  const p = partners.find((x) => x.id === v);
                  if (p) {
                    setAmount((p.balanceInr / 100).toFixed(2));
                    setCurrency(p.perCurrency[0]?.currency ?? "INR");
                  }
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
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
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
              label={`Amount (${currency})`}
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
              <Input id="po-date" name="paidOn" type="date" defaultValue={isoDate(new Date())} />
            </Field>
            <Field id="po-ref" label="Bank reference" required>
              <Input
                id="po-ref"
                name="reference"
                className="font-mono"
                placeholder="NEFT N…"
                required
                aria-required
              />
            </Field>
            <Field id="po-note" label="Note" optional>
              <Textarea id="po-note" name="note" rows={2} />
            </Field>
          </form>
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
              <Button variant="ghost" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              disabled={over > 0 || !Number.isFinite(amountMinor) || amountMinor <= 0 || submitting}
              onClick={() => {
                void handleSubmit();
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
