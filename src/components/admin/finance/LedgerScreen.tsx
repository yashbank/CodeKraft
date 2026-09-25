"use client";

import Link from "next/link";
import * as React from "react";
import { ChevronDownIcon, DownloadIcon, LockIcon, ScrollTextIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/_utils";
import { STATUS_ENUMS } from "@/lib/status-tone";
import { DataToolbar, ToolbarField } from "../DataToolbar";
import { EmptyState } from "../EmptyState";
import { formatDateTime, inr, timeAgo } from "../format";
import { MoneyCell } from "../MoneyCell";
import { PageHeader } from "../PageHeader";
import { RowActions } from "../RowActions";
import { StatTile } from "../StatTile";
import type { LedgerEntry } from "../types";

export interface LedgerScreenProps {
  entries: LedgerEntry[];
  now: string;
  lastPostedAt: string;
  orderHref: string;
  adjustmentsHref: string;
  approvalsHref: string;
  isSuperAdmin: boolean;
}

/**
 * SCR-ADM-17 — the immutable journal (BR-17). Summary strip, dense table with type chips, signed
 * mono amounts (negatives in danger, "credit/debit" for screen readers), lock icon per row, and
 * row expand showing the sibling entries of the same posting. No edit/delete affordances.
 */
export function LedgerScreen({
  entries,
  now,
  lastPostedAt,
  orderHref,
  adjustmentsHref,
  approvalsHref,
  isSuperAdmin,
}: LedgerScreenProps) {
  const [type, setType] = React.useState<string>("all");
  const [currency, setCurrency] = React.useState<"native" | "inr">("native");
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const rows = entries.filter((e) => (type === "all" ? true : e.type === type));
  const credits = rows.filter((e) => e.amountInr > 0).reduce((s, e) => s + e.amountInr, 0);
  const debits = rows.filter((e) => e.amountInr < 0).reduce((s, e) => s + e.amountInr, 0);

  return (
    <TooltipProvider>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Ledger
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-fg-subtle">
                  <LockIcon aria-hidden className="size-5" />
                  <span className="sr-only">Immutable</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Entries are immutable; corrections are adjustments.</TooltipContent>
            </Tooltip>
          </span>
        }
        description="Every entry posted on payment confirmation, refund reversals, payouts, expenses and approved adjustments — in transaction currency and INR (D-515)."
        actions={
          <>
            <Badge tone="neutral" dot>
              Last posted {timeAgo(lastPostedAt, now)}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast("Export queued for the current filter (audited)")}
            >
              <DownloadIcon aria-hidden /> Export CSV
            </Button>
          </>
        }
      />
      <DataToolbar
        searchId="ledger-order"
        searchPlaceholder="Order no…"
        searchLabel="Order number"
        filters={
          <>
            <ToolbarField id="ledger-from" label="From">
              <Input id="ledger-from" type="date" defaultValue="2026-08-26" className="h-8 w-40" />
            </ToolbarField>
            <ToolbarField id="ledger-to" label="To">
              <Input id="ledger-to" type="date" defaultValue="2026-09-25" className="h-8 w-40" />
            </ToolbarField>
            <ToolbarField id="ledger-type" label="Entry type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="ledger-type" size="sm" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {STATUS_ENUMS["ledger_entries.entry_type"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="ledger-party" label="Party type">
              <Select>
                <SelectTrigger id="ledger-party" size="sm" className="w-36">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {["company", "partner", "tax_authority", "gateway", "bank", "customer"].map(
                    (p) => (
                      <SelectItem key={p} value={p}>
                        {p.replace("_", " ")}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="ledger-partner" label="Partner">
              <Select>
                <SelectTrigger id="ledger-partner" size="sm" className="w-36">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p-priya">Priya Nair</SelectItem>
                  <SelectItem value="p-arjun">Arjun Mehta</SelectItem>
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="ledger-currency" label="Currency">
              <Select value={currency} onValueChange={(v) => setCurrency(v as typeof currency)}>
                <SelectTrigger id="ledger-currency" size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="native">Native</SelectItem>
                  <SelectItem value="inr">INR</SelectItem>
                </SelectContent>
              </Select>
            </ToolbarField>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatTile label="Σ credits" value={inr(credits)} />
        <StatTile label="Σ debits" value={inr(debits)} deltaTone="danger" />
        <StatTile label="Net" value={inr(credits + debits)} />
        <StatTile label="Entries" value={rows.length} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={ScrollTextIcon} title="No entries in this range" />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableCaption className="sr-only">Ledger entries</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-(--ck-z-raised) bg-surface">Seq</TableHead>
                <TableHead className="sticky left-16 z-(--ck-z-raised) bg-surface">
                  Date / time
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Ccy</TableHead>
                <TableHead className="text-right">FX</TableHead>
                <TableHead className="text-right">Amount INR</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => {
                const open = expanded === e.seq;
                const siblings = e.ref
                  ? entries.filter((s) => s.ref === e.ref && s.seq !== e.seq)
                  : [];
                const hidden =
                  !isSuperAdmin && e.partyType === "partner" && e.party !== "Priya Nair";
                return (
                  <React.Fragment key={e.seq}>
                    <TableRow>
                      <TableCell className="sticky left-0 z-(--ck-z-raised) bg-surface font-mono">
                        <span className="inline-flex items-center gap-1">
                          <LockIcon aria-hidden className="size-3.5 text-fg-subtle" />
                          {e.seq}
                        </span>
                      </TableCell>
                      <TableCell className="sticky left-16 z-(--ck-z-raised) bg-surface text-fg-muted">
                        {formatDateTime(e.at)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="ledger_entries.entry_type" value={e.type} size="sm" />
                      </TableCell>
                      <TableCell>{hidden ? "Other partner" : e.party}</TableCell>
                      <TableCell>
                        {e.order ? (
                          <Link
                            href={orderHref}
                            className="font-mono text-accent-text hover:underline"
                          >
                            {e.order}
                          </Link>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <MoneyCell
                          value={
                            currency === "inr"
                              ? { amountMinor: e.amountInr, currency: "INR" }
                              : e.amount
                          }
                          signed
                        />
                      </TableCell>
                      <TableCell className="font-mono text-fg-muted">{e.amount.currency}</TableCell>
                      <TableCell className="text-right font-mono text-caption text-fg-muted">
                        {e.fxRate ?? "—"}
                      </TableCell>
                      <TableCell>
                        <MoneyCell value={{ amountMinor: e.amountInr, currency: "INR" }} signed />
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-fg-muted">{e.memo}</TableCell>
                      <TableCell>
                        {e.ref ? (
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={`posting-${e.seq}`}
                            onClick={() => setExpanded(open ? null : e.seq)}
                            className="inline-flex items-center gap-1 font-mono text-caption text-accent-text hover:underline"
                          >
                            {e.ref}{" "}
                            <ChevronDownIcon
                              aria-hidden
                              className={cn("size-3 transition-transform", open && "rotate-180")}
                            />
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-fg-muted">{e.createdBy}</TableCell>
                      <TableCell>
                        <RowActions
                          label={`Actions for entry ${e.seq}`}
                          actions={[
                            { label: "Copy seq", onSelect: () => toast.success(`Copied ${e.seq}`) },
                            { label: "Open order", href: orderHref, disabled: !e.order },
                            {
                              label: "Propose adjustment referencing this entry",
                              href: adjustmentsHref,
                              separatorBefore: true,
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                    {open ? (
                      <TableRow id={`posting-${e.seq}`}>
                        <TableCell colSpan={13} className="bg-canvas whitespace-normal">
                          <p className="mb-2 text-body-sm font-semibold">
                            Posting {e.ref} · {siblings.length + 1} entries
                          </p>
                          <ul className="grid gap-1 text-body-sm sm:grid-cols-2 lg:grid-cols-3">
                            {[e, ...siblings]
                              .sort((a, b) => a.seq - b.seq)
                              .map((s) => (
                                <li
                                  key={s.seq}
                                  className="flex items-center justify-between gap-2 rounded-sm bg-surface px-2 py-1"
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span className="font-mono text-caption text-fg-muted">
                                      {s.seq}
                                    </span>
                                    <StatusBadge
                                      kind="ledger_entries.entry_type"
                                      value={s.type}
                                      size="sm"
                                      hideIcon
                                    />
                                    <span className="text-fg-muted">{s.party}</span>
                                  </span>
                                  <MoneyCell value={s.amount} signed />
                                </li>
                              ))}
                          </ul>
                          {e.ref?.startsWith("apr-") ? (
                            <Link
                              href={approvalsHref}
                              className="mt-2 inline-block text-caption text-accent-text hover:underline"
                            >
                              View approval request
                            </Link>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-body-sm text-fg-muted">
            <span>{rows.length} entries · cursor by seq</span>
            <span>50 per page</span>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
