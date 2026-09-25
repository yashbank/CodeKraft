"use client";

import Link from "next/link";
import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { parseMinor } from "@/lib/money";
import { ApprovalGateNotice, Banner } from "../Banner";
import { FilterChips } from "../FilterChips";
import { formatDateTime, inr } from "../format";
import { MoneyCell } from "../MoneyCell";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import type { AdjustmentLine, AdjustmentRow, PartnerBalance } from "../types";

const PARTY_LABEL: Record<AdjustmentLine["partyType"], string> = {
  company: "Company",
  partner: "Partner",
  tax_authority: "Tax authority",
  bank: "Bank",
  gateway: "Gateway",
  customer: "Customer",
};

interface DraftLine {
  id: number;
  partyType: AdjustmentLine["partyType"];
  partner?: string;
  amount: string;
  memo: string;
  order?: string;
}

export interface AdjustmentsScreenProps {
  adjustments: AdjustmentRow[];
  partners: PartnerBalance[];
  approvers: string[];
  approvalsHref: string;
  ledgerHref: string;
  initialView?: "list" | "new";
  prefillRef?: string;
}

/** SCR-ADM-21 — adjustments list and the New-adjustment form (lines editor + impact preview), dual-approved. */
export function AdjustmentsScreen({
  adjustments,
  partners,
  approvers,
  approvalsHref,
  ledgerHref,
  initialView = "list",
  prefillRef,
}: AdjustmentsScreenProps) {
  const [view, setView] = React.useState(initialView);
  const [status, setStatus] = React.useState<AdjustmentRow["status"] | null>(null);
  const [lines, setLines] = React.useState<DraftLine[]>([
    {
      id: 1,
      partyType: "bank",
      amount: "-40.00",
      memo: "Shortfall write-off",
      order: prefillRef ?? "CK-ORD-000009",
    },
    { id: 2, partyType: "company", amount: "40.00", memo: "Balancing line" },
  ]);
  const [reason, setReason] = React.useState("");
  const [justify, setJustify] = React.useState(false);
  const minor = (s: string) => {
    try {
      return parseMinor(s || "0", "INR");
    } catch {
      return 0;
    }
  };
  const net = lines.reduce((s, l) => s + minor(l.amount), 0);
  const allZero = lines.every((l) => minor(l.amount) === 0);
  const byParty = lines.reduce((m, l) => {
    const k = l.partyType === "partner" ? (l.partner ?? "Partner") : PARTY_LABEL[l.partyType];
    return m.set(k, (m.get(k) ?? 0) + minor(l.amount));
  }, new Map<string, number>());
  const rows = adjustments
    .filter((a) => (status ? a.status === status : true))
    .sort((a, b) => (a.status === "pending" ? -1 : b.status === "pending" ? 1 : 0));
  const setLine = (id: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const canSubmit = reason.trim().length >= 20 && !allZero && (net === 0 || justify);

  return (
    <>
      <PageHeader
        title={view === "list" ? "Adjustments" : "New adjustment"}
        description="Correcting journal entries — never edits. Each adjustment is a set of signed lines that must be explained and approved by all other admins (D-517)."
        actions={
          view === "list" ? (
            <Button size="sm" onClick={() => setView("new")}>
              <PlusIcon aria-hidden /> New adjustment
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setView("list")}>
              Back to list
            </Button>
          )
        }
      />
      <Banner tone="warning" className="mb-4">
        Adjustments never change existing entries; they add new ones (BR-17).
      </Banner>

      {view === "list" ? (
        <>
          <FilterChips
            label="Status"
            chips={[
              {
                value: "pending",
                label: "Awaiting approval",
                count: adjustments.filter((a) => a.status === "pending").length,
              },
              {
                value: "applied",
                label: "Applied",
                count: adjustments.filter((a) => a.status === "applied").length,
              },
              {
                value: "rejected",
                label: "Rejected",
                count: adjustments.filter((a) => a.status === "rejected").length,
              },
              { value: "cancelled", label: "Cancelled", count: 0 },
            ]}
            value={status}
            onChange={setStatus}
          />
          <div className="mt-4 rounded-lg border border-border bg-surface">
            <Table>
              <TableCaption className="sr-only">Adjustments</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead>Net by party</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Approver / decided</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ledger seqs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-fg-muted">
                      No adjustments — that&rsquo;s good
                    </TableCell>
                  </TableRow>
                ) : null}
                {rows.map((a) => {
                  const nets = a.lines.reduce((m, l) => {
                    const k =
                      l.partyType === "partner"
                        ? ((l.partner ?? "Partner").split(" ")[0] ?? "Partner")
                        : PARTY_LABEL[l.partyType];
                    return m.set(k, (m.get(k) ?? 0) + l.amount.amountMinor);
                  }, new Map<string, number>());
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-fg-muted">{formatDateTime(a.createdAt)}</TableCell>
                      <TableCell className="max-w-72 truncate" title={a.reason}>
                        {a.reason}
                      </TableCell>
                      <TableCell className="text-right font-mono tnum">{a.lines.length}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          {[...nets.entries()].map(([k, v]) => (
                            <Badge key={k} tone={v < 0 ? "danger" : "success"} size="sm">
                              {k} {v < 0 ? "−" : "+"}
                              {inr(Math.abs(v))}
                            </Badge>
                          ))}
                        </span>
                      </TableCell>
                      <TableCell className="text-fg-muted">{a.requestedBy}</TableCell>
                      <TableCell className="text-fg-muted">
                        {a.approver
                          ? `${a.approver} · ${a.decidedAt ? formatDateTime(a.decidedAt) : ""}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {a.status === "pending" ? (
                          <Link href={approvalsHref}>
                            <StatusBadge
                              kind="approval_requests.status"
                              value="pending"
                              size="sm"
                            />
                          </Link>
                        ) : (
                          <StatusBadge
                            kind="approval_requests.status"
                            value={a.status}
                            size="sm"
                            hideIcon
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {a.ledgerSeqs ? (
                          <Link
                            href={ledgerHref}
                            className="font-mono text-accent-text hover:underline"
                          >
                            {a.ledgerSeqs.join(", ")}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <form className="space-y-5 lg:col-span-8" onSubmit={(e) => e.preventDefault()}>
            <Field
              id="adj-reason"
              label="Reason"
              required
              hint={`${reason.length}/1000 · at least 20 characters`}
              error={
                reason.length > 0 && reason.trim().length < 20
                  ? "Explain what was wrong and what this corrects."
                  : undefined
              }
            >
              <Textarea
                id="adj-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain what was wrong and what this corrects"
                maxLength={1000}
              />
            </Field>
            <Field id="adj-ref" label="Reference (order / entry seq)" optional>
              <Input
                id="adj-ref"
                defaultValue={prefillRef ?? "CK-ORD-000009"}
                className="font-mono"
              />
            </Field>
            <fieldset className="space-y-3">
              <legend className="text-h4">Lines</legend>
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableCaption className="sr-only">Adjustment lines</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Party type</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead className="text-right">Amount (INR, signed)</TableHead>
                      <TableHead>Memo</TableHead>
                      <TableHead>Order / item</TableHead>
                      <TableHead className="w-10">
                        <span className="sr-only">Remove</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <Label htmlFor={`ln-party-${l.id}`} className="sr-only">
                            Party type, line {i + 1}
                          </Label>
                          <Select
                            value={l.partyType}
                            onValueChange={(v) =>
                              setLine(l.id, { partyType: v as AdjustmentLine["partyType"] })
                            }
                          >
                            <SelectTrigger id={`ln-party-${l.id}`} size="sm" className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(PARTY_LABEL) as AdjustmentLine["partyType"][]).map(
                                (p) => (
                                  <SelectItem key={p} value={p}>
                                    {PARTY_LABEL[p]}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Label htmlFor={`ln-partner-${l.id}`} className="sr-only">
                            Partner, line {i + 1}
                          </Label>
                          <Select
                            value={l.partner ?? ""}
                            onValueChange={(v) => setLine(l.id, { partner: v })}
                            disabled={l.partyType !== "partner"}
                          >
                            <SelectTrigger id={`ln-partner-${l.id}`} size="sm" className="w-36">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {partners.map((p) => (
                                <SelectItem key={p.id} value={p.name}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Label htmlFor={`ln-amount-${l.id}`} className="sr-only">
                            Amount, line {i + 1}
                          </Label>
                          <Input
                            id={`ln-amount-${l.id}`}
                            inputMode="decimal"
                            value={l.amount}
                            onChange={(e) => setLine(l.id, { amount: e.target.value })}
                            className="h-8 w-32 text-right font-mono tnum"
                          />
                        </TableCell>
                        <TableCell>
                          <Label htmlFor={`ln-memo-${l.id}`} className="sr-only">
                            Memo, line {i + 1}
                          </Label>
                          <Input
                            id={`ln-memo-${l.id}`}
                            value={l.memo}
                            onChange={(e) => setLine(l.id, { memo: e.target.value })}
                            className="h-8"
                            required
                            aria-required
                          />
                        </TableCell>
                        <TableCell>
                          <Label htmlFor={`ln-order-${l.id}`} className="sr-only">
                            Order, line {i + 1}
                          </Label>
                          <Input
                            id={`ln-order-${l.id}`}
                            value={l.order ?? ""}
                            onChange={(e) => setLine(l.id, { order: e.target.value })}
                            className="h-8 w-36 font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove line ${i + 1}`}
                            onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                            disabled={lines.length === 1}
                          >
                            <Trash2Icon aria-hidden className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLines((ls) => [
                      ...ls,
                      { id: Date.now(), partyType: "company", amount: "0.00", memo: "" },
                    ])
                  }
                >
                  <PlusIcon aria-hidden /> Add line
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setLines((ls) => [
                      ...ls,
                      {
                        id: Date.now(),
                        partyType: "company",
                        amount: (-net / 100).toFixed(2),
                        memo: "Balancing line",
                      },
                    ])
                  }
                  disabled={net === 0}
                >
                  Add balancing line
                </Button>
                <p role="status" aria-live="polite" className="ml-auto font-mono text-body-sm tnum">
                  Σ {net < 0 ? "−" : ""}
                  {inr(Math.abs(net))}
                </p>
              </div>
            </fieldset>
          </form>
          <aside className="space-y-4 lg:col-span-4">
            <section
              aria-label="Impact preview"
              className="rounded-lg border border-border bg-surface p-4"
            >
              <h2 className="mb-2 text-h4">Impact preview</h2>
              <table className="w-full text-body-sm">
                <caption className="sr-only">Net effect per party</caption>
                <thead>
                  <tr className="text-left text-caption text-fg-muted">
                    <th scope="col" className="font-medium">
                      Party
                    </th>
                    <th scope="col" className="text-right font-medium">
                      Net
                    </th>
                    <th scope="col" className="text-right font-medium">
                      Balance after
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...byParty.entries()].map(([party, v]) => {
                    const p = partners.find((x) => x.name === party);
                    return (
                      <tr key={party} className="border-t border-border">
                        <th scope="row" className="py-1.5 text-left font-normal">
                          {party}
                        </th>
                        <td className="py-1.5">
                          <MoneyCell value={{ amountMinor: v, currency: "INR" }} signed />
                        </td>
                        <td className="py-1.5 text-right font-mono tnum">
                          {p ? inr(p.balanceInr + v) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
            <section
              aria-label="Validation"
              className="space-y-2 rounded-lg border border-border bg-surface p-4"
            >
              <h2 className="text-h4">Validation</h2>
              {allZero ? (
                <p className="text-body-sm text-danger">Lines must not all be zero.</p>
              ) : null}
              {net !== 0 ? (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="adj-justify"
                    checked={justify}
                    onCheckedChange={(v) => setJustify(v === true)}
                  />
                  <Label htmlFor="adj-justify" className="leading-snug">
                    Explain unbalanced totals — I am deliberately posting Σ ≠ 0 (e.g. writing off a
                    shortfall) and the reason says why.
                  </Label>
                </div>
              ) : (
                <p className="text-body-sm text-success">Lines balance.</p>
              )}
            </section>
            <ApprovalGateNotice approvers={approvers} what="Proposing an adjustment" />
            <Button
              className="w-full"
              disabled={!canSubmit}
              onClick={() => {
                toast.success("Adjustment sent for approval");
                setView("list");
              }}
            >
              Request approval
            </Button>
            <p className="text-caption text-fg-muted">
              Another admin must approve. Entries post only after approval.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
