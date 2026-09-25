"use client";

import Link from "next/link";
import * as React from "react";
import { ChevronDownIcon, DownloadIcon, InfoIcon } from "lucide-react";
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
import { DataToolbar, ToolbarField } from "../DataToolbar";
import { formatDate, inr, money, percentFromBps } from "../format";
import { MoneyCell } from "../MoneyCell";
import { PageHeader } from "../PageHeader";
import { StatTile } from "../StatTile";
import type { AllocationRow } from "../types";

export interface AllocationsScreenProps {
  rows: AllocationRow[];
  partners: string[];
  orderHref: string;
  ledgerHref: string;
  productHref: string;
  isSuperAdmin: boolean;
}

/** SCR-ADM-18 — per-order-item money split with dynamic partner columns and a waterfall on row expand. */
export function AllocationsScreen({
  rows,
  partners,
  orderHref,
  ledgerHref,
  productHref,
  isSuperAdmin,
}: AllocationsScreenProps) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const sum = (f: (r: AllocationRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const partnerName = (n: string) => (isSuperAdmin || n === "Priya Nair" ? n : "Other partner");

  return (
    <TooltipProvider>
      <PageHeader
        title="Allocations"
        description="How each paid order item was split: gross → discount → tax → gateway fee → bank shortfall → distributable → company cut → partner lines, with the ownership version used."
        actions={
          <Button variant="outline" size="sm" onClick={() => toast("Export queued (audited)")}>
            <DownloadIcon aria-hidden /> Export CSV
          </Button>
        }
      />
      <DataToolbar
        searchId="alloc-order"
        searchPlaceholder="Order no…"
        filters={
          <>
            <ToolbarField id="alloc-from" label="From">
              <Input id="alloc-from" type="date" defaultValue="2026-06-27" className="h-8 w-40" />
            </ToolbarField>
            <ToolbarField id="alloc-to" label="To">
              <Input id="alloc-to" type="date" defaultValue="2026-09-25" className="h-8 w-40" />
            </ToolbarField>
            <ToolbarField id="alloc-product" label="Product">
              <Select>
                <SelectTrigger id="alloc-product" size="sm" className="w-40">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fitdesk">FitDesk Pro</SelectItem>
                  <SelectItem value="tradeflow">TradeFlow</SelectItem>
                  <SelectItem value="shopsync">ShopSync</SelectItem>
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="alloc-partner" label="Partner">
              <Select>
                <SelectTrigger id="alloc-partner" size="sm" className="w-40">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="alloc-version" label="Ownership version">
              <Select>
                <SelectTrigger id="alloc-version" size="sm" className="w-32">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1">v1</SelectItem>
                  <SelectItem value="v2">v2</SelectItem>
                </SelectContent>
              </Select>
            </ToolbarField>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Gross" value={inr(sum((r) => r.gross.amountMinor))} />
        <StatTile
          label="Distributable"
          value={inr(sum((r) => r.distributable.amountMinor))}
          hint="gross − discount − tax − gateway fee − bank shortfall (BR-06)"
        />
        <StatTile label="Company" value={inr(sum((r) => r.companyCut.amount.amountMinor))} />
        {partners.map((p) => (
          <StatTile
            key={p}
            label={partnerName(p)}
            value={inr(sum((r) => r.partners.find((x) => x.name === p)?.amount.amountMinor ?? 0))}
          />
        ))}
      </div>
      <p className="mb-3 text-caption text-fg-muted">
        Largest-remainder rounding; lines always sum exactly.
      </p>
      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableCaption className="sr-only">Allocations</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <span className="sr-only">Expand</span>
              </TableHead>
              <TableHead className="sticky left-8 z-(--ck-z-raised) bg-surface">Date</TableHead>
              <TableHead className="sticky left-32 z-(--ck-z-raised) bg-surface">
                Order / item
              </TableHead>
              <TableHead>Product · offering</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Gateway fee</TableHead>
              <TableHead className="text-right">Bank charge</TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-1">
                      Distributable <InfoIcon aria-hidden className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    gross − discount − tax − gateway fee − bank shortfall (BR-06)
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right">Company cut</TableHead>
              {partners.map((p) => (
                <TableHead key={p} className="text-right">
                  {partnerName(p)}
                </TableHead>
              ))}
              <TableHead>Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const open = expanded === r.id;
              return (
                <React.Fragment key={r.id}>
                  <TableRow className={cn(r.isRefund && "text-danger")}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-expanded={open}
                        aria-controls={`alloc-${r.id}`}
                        aria-label={`${open ? "Collapse" : "Expand"} ${r.order}`}
                        onClick={() => setExpanded(open ? null : r.id)}
                      >
                        <ChevronDownIcon
                          aria-hidden
                          className={cn("size-4 transition-transform", open && "rotate-180")}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="sticky left-8 z-(--ck-z-raised) bg-surface text-fg-muted">
                      {formatDate(r.at)}
                    </TableCell>
                    <TableCell className="sticky left-32 z-(--ck-z-raised) bg-surface">
                      <Link href={orderHref} className="font-mono text-accent-text hover:underline">
                        {r.order}
                      </Link>{" "}
                      <span className="text-fg-muted">/ {r.item}</span>
                      {r.isRefund ? (
                        <Badge tone="danger" size="sm" className="ml-2">
                          Refund
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Link href={productHref} className="hover:text-accent-text">
                        {r.product}
                      </Link>{" "}
                      <span className="text-fg-muted">· {r.offering}</span>
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={r.gross} signed={r.isRefund} />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={r.discount} />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={r.tax} signed={r.isRefund} />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={r.gatewayFee} />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={r.bankCharge} />
                    </TableCell>
                    <TableCell>
                      <MoneyCell value={r.distributable} signed={r.isRefund} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="block font-mono tnum">{money(r.companyCut.amount)}</span>
                      <span className="text-caption text-fg-muted">
                        {percentFromBps(r.companyCut.bps)}
                      </span>
                    </TableCell>
                    {partners.map((p) => {
                      const line = r.partners.find((x) => x.name === p);
                      return (
                        <TableCell key={p} className="text-right">
                          {line ? (
                            <>
                              <span className="block font-mono tnum">{money(line.amount)}</span>
                              <span className="text-caption text-fg-muted">
                                {percentFromBps(line.bps)}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Badge tone="ghost" size="sm">
                        {r.ownershipVersion}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {open ? (
                    <TableRow id={`alloc-${r.id}`}>
                      <TableCell
                        colSpan={12 + partners.length}
                        className="bg-canvas whitespace-normal"
                      >
                        <Waterfall row={r} partnerName={partnerName} />
                        <p className="mt-2 flex gap-3 text-caption">
                          <Link href={ledgerHref} className="text-accent-text hover:underline">
                            Ledger entries
                          </Link>
                          <Link href={orderHref} className="text-accent-text hover:underline">
                            Order
                          </Link>
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}

/** Waterfall: gross → distributable → splits, as labelled bars with a text table. */
function Waterfall({
  row,
  partnerName,
}: {
  row: AllocationRow;
  partnerName: (n: string) => string;
}) {
  const steps = [
    { label: "Gross", value: Math.abs(row.gross.amountMinor), tone: "bg-chart-1" },
    { label: "− Discount", value: row.discount.amountMinor, tone: "bg-chart-3" },
    { label: "− Tax", value: Math.abs(row.tax.amountMinor), tone: "bg-chart-6" },
    { label: "− Bank charge", value: row.bankCharge.amountMinor, tone: "bg-chart-4" },
    { label: "Distributable", value: Math.abs(row.distributable.amountMinor), tone: "bg-chart-1" },
    { label: "Company", value: Math.abs(row.companyCut.amount.amountMinor), tone: "bg-chart-1" },
    ...row.partners.map((p, i) => ({
      label: partnerName(p.name),
      value: Math.abs(p.amount.amountMinor),
      tone: i === 0 ? "bg-chart-2" : "bg-chart-3",
    })),
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol aria-label={`Allocation waterfall for ${row.order}`} className="space-y-1">
      {steps.map((s) => (
        <li
          key={s.label}
          className="grid grid-cols-[120px_1fr_140px] items-center gap-2 text-caption"
        >
          <span className="text-fg-muted">{s.label}</span>
          <span className="h-3 rounded-xs bg-elevated">
            <span
              className={cn("block h-full rounded-xs", s.tone)}
              style={{ width: `${(s.value / max) * 100}%` }}
              aria-hidden
            />
          </span>
          <span className="text-right font-mono tnum">{inr(s.value)}</span>
        </li>
      ))}
    </ol>
  );
}
