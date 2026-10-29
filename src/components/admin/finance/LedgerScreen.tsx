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
import { UrlSelect } from "./UrlSelect";
import { useUrlFilters, useUrlSearch } from "./use-url-filters";
import { currencySchema } from "@/modules/_shared/zod";
import { EmptyState } from "../EmptyState";
import { drCr, formatDateTime, inr, ledgerTotals, money, timeAgo } from "../format";
import { MoneyCell } from "../MoneyCell";
import { PageHeader } from "../PageHeader";
import { RowActions } from "../RowActions";
import { StatTile } from "../StatTile";
import type { FinanceSummary as FinanceSummaryView } from "@/modules/finance/metrics";
import type { LedgerEntry } from "../types";

export interface LedgerScreenProps {
  entries: LedgerEntry[];
  now: string;
  lastPostedAt: string;
  orderHref: string;
  adjustmentsHref: string;
  approvalsHref: string;
  isSuperAdmin: boolean;
  /** The viewer's own partner display name (non-super-admins see only their own line). */
  ownPartnerName?: string | null;
  /** All-time labelled finance metrics (modules/finance/metrics.ts); omitted without reports access. */
  summary?: FinanceSummaryView | null;
  /** Partner filter options (id -> display name). */
  partners?: Array<{ id: string; name: string }>;
}

const LEDGER_PARAMS = ["from", "to", "type", "party", "partner", "ccy", "q"];

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
  ownPartnerName = null,
  summary = null,
  partners = [],
}: LedgerScreenProps) {
  const f = useUrlFilters();
  const [search, setSearch] = useUrlSearch();
  const [currency, setCurrency] = React.useState<"native" | "inr">("native");
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const rows = entries; // filtered server-side by the URL params
  const { credits, debits, net } = ledgerTotals(rows.map((e) => e.amountInr));

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
        description="Every entry posted on payment confirmation, refund reversals, payouts, expenses and approved adjustments — in transaction currency and INR."
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
        searchPlaceholder="Order no (CK-ORD-000123)…"
        searchLabel="Order number"
        searchValue={search}
        onSearchChange={setSearch}
        filters={
          <>
            <ToolbarField id="ledger-from" label="From">
              <Input
                id="ledger-from"
                type="date"
                className="h-8 w-40"
                value={f.get("from")}
                max={f.get("to") || undefined}
                onChange={(e) => f.set("from", e.target.value)}
              />
            </ToolbarField>
            <ToolbarField id="ledger-to" label="To">
              <Input
                id="ledger-to"
                type="date"
                className="h-8 w-40"
                value={f.get("to")}
                min={f.get("from") || undefined}
                onChange={(e) => f.set("to", e.target.value)}
              />
            </ToolbarField>
            <UrlSelect
              id="ledger-type"
              label="Entry type"
              param="type"
              f={f}
              width="w-44"
              anyLabel="All types"
            >
              {STATUS_ENUMS["ledger_entries.entry_type"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </UrlSelect>
            <UrlSelect id="ledger-party" label="Party type" param="party" f={f} width="w-36">
              {["company", "partner", "tax_authority", "gateway", "bank", "customer"].map((p) => (
                <SelectItem key={p} value={p}>
                  {p.replace("_", " ")}
                </SelectItem>
              ))}
            </UrlSelect>
            {partners.length > 0 ? (
              <UrlSelect id="ledger-partner" label="Partner" param="partner" f={f} width="w-36">
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </UrlSelect>
            ) : null}
            <UrlSelect id="ledger-ccy" label="Currency" param="ccy" f={f} width="w-28">
              {currencySchema.options.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </UrlSelect>
            <ToolbarField id="ledger-currency" label="Show amounts in">
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
            {f.active(LEDGER_PARAMS) ? (
              <Button variant="ghost" size="sm" onClick={() => f.clear(LEDGER_PARAMS)}>
                Clear filters
              </Button>
            ) : null}
          </>
        }
      />
      {summary ? (
        <div
          className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4"
          aria-label="Finance summary (all time)"
        >
          <StatTile label="Gross sales (list price)" value={inr(summary.grossSalesMinor)} />
          <StatTile label="Discounts / coupons" value={inr(summary.discountsMinor)} />
          <StatTile label="Net sales" value={inr(summary.netSalesMinor)} hint="gross − discounts" />
          <StatTile label="Tax collected" value={inr(summary.taxCollectedMinor)} />
          <StatTile label="Collected" value={inr(summary.collectedMinor)} hint="net sales + tax" />
          <StatTile label="Outstanding (unpaid orders)" value={inr(summary.outstandingMinor)} />
          <StatTile label="Refunds" value={inr(summary.refundsMinor)} />
          <StatTile label="Gateway fees / bank shortfall" value={inr(summary.feesMinor)} />
          <StatTile label="Company share" value={inr(summary.companyShareMinor)} />
          <StatTile label="Partner shares" value={inr(summary.partnerSharesMinor)} />
          <StatTile label="Expenses" value={inr(summary.expensesMinor)} />
          <StatTile
            label="Profit"
            value={inr(summary.profitMinor)}
            hint="company + partner shares − expenses"
          />
        </div>
      ) : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatTile label="Σ credits" value={inr(credits)} />
        <StatTile label="Σ debits" value={inr(debits)} deltaTone="danger" />
        <StatTile label="Net" value={inr(net)} />
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
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Ccy</TableHead>
                <TableHead className="text-right">FX</TableHead>
                <TableHead className="text-right">Amount INR (Dr/Cr)</TableHead>
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
                // Non-super-admins only see their own partner name (R8-04: was a fixture name).
                const hidden =
                  !isSuperAdmin && e.partyType === "partner" && e.party !== ownPartnerName;
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
                      {(() => {
                        const shown =
                          currency === "inr"
                            ? { amountMinor: e.amountInr, currency: "INR" as const }
                            : e.amount;
                        const { debit, credit } = drCr(shown.amountMinor);
                        const cell = (n: number, tone?: string) => (
                          <TableCell className={cn("text-right font-mono tnum", tone)}>
                            {n ? money({ amountMinor: n, currency: shown.currency }) : "—"}
                          </TableCell>
                        );
                        return (
                          <>
                            {cell(debit, "text-danger")}
                            {cell(credit)}
                          </>
                        );
                      })()}
                      <TableCell className="font-mono text-fg-muted">{e.amount.currency}</TableCell>
                      <TableCell className="text-right font-mono text-caption text-fg-muted">
                        {e.fxRate ?? "—"}
                      </TableCell>
                      <TableCell>
                        <MoneyCell
                          value={{ amountMinor: Math.abs(e.amountInr), currency: "INR" }}
                          className={e.amountInr < 0 ? "text-danger" : undefined}
                        />
                      </TableCell>
                      <TableCell className="max-w-56 text-fg-muted">
                        <span className="block truncate" title={e.memo ?? undefined}>
                          {e.memo}
                        </span>
                      </TableCell>
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
                        <TableCell colSpan={14} className="bg-canvas whitespace-normal">
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
                                  <MoneyCell
                                    value={{
                                      ...s.amount,
                                      amountMinor: Math.abs(s.amount.amountMinor),
                                    }}
                                    className={s.amount.amountMinor < 0 ? "text-danger" : undefined}
                                  />
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
