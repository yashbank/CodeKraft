"use client";

import * as React from "react";
import { DownloadIcon, InfoIcon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/_utils";
import { exportStatement } from "@/modules/finance/admin-mutations";
import { BarChart } from "../charts/BarChart";
import { formatDateTime, inr } from "../format";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import { StatTile } from "../StatTile";
import type {
  CustomerCreditRow,
  ReportDefinition,
  ReportKey,
  StatementHistoryRow,
  StatementPreview,
} from "../types";

const PRESETS = ["This month", "Last month", "This FY", "Last FY", "Custom"];

export interface ReportsScreenPartner {
  id: string;
  name: string;
}

export interface ReportsScreenProps {
  reports: ReportDefinition[];
  customerCredits: CustomerCreditRow[];
  partners: ReportsScreenPartner[];
  statement: StatementPreview;
  statementHistory: StatementHistoryRow[];
  isSuperAdmin: boolean;
  initialTab?: "reports" | "statements";
  initialReport?: ReportKey;
}

/** UTC calendar-period bounds for the statement generator's period preset (`custom` has no date
 * inputs wired in this screen, so it falls back to the current month -- see report). */
function periodRange(preset: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (preset === "last") {
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 0));
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
  }
  if (preset === "fy") {
    const fyStartYear = m >= 3 ? y : y - 1;
    return { dateFrom: `${fyStartYear}-04-01`, dateTo: now.toISOString().slice(0, 10) };
  }
  const from = new Date(Date.UTC(y, m, 1));
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: now.toISOString().slice(0, 10) };
}

/** SCR-ADM-22 — reports (left rail, controls, tiles, chart, table with totals row, export) and partner statements (form, preview, history). */
export function ReportsScreen({
  reports,
  customerCredits,
  partners,
  statement,
  statementHistory,
  isSuperAdmin,
  initialTab = "reports",
  initialReport = "revenue_by_period",
}: ReportsScreenProps) {
  const [key, setKey] = React.useState<ReportKey>(initialReport);
  const [preset, setPreset] = React.useState("This FY");
  const [stPartnerId, setStPartnerId] = React.useState(partners[0]?.id ?? "");
  const [stPeriod, setStPeriod] = React.useState("last");
  const [stFormat, setStFormat] = React.useState<"pdf" | "csv">("pdf");
  const [generating, setGenerating] = React.useState(false);
  const report = reports.find((r) => r.key === key) ?? reports[0];
  if (!report) return null;

  async function handleGenerateStatement() {
    if (!stPartnerId) {
      toast.error("Pick a partner.");
      return;
    }
    setGenerating(true);
    const { dateFrom, dateTo } = periodRange(stPeriod);
    const result = await exportStatement({
      partnerId: stPartnerId,
      dateFrom,
      dateTo,
      format: stFormat,
    });
    setGenerating(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
    toast.success(`${result.data.filename} ready — link valid 5 min`);
  }

  return (
    <TooltipProvider>
      <PageHeader
        title="Reports & statements"
        description="All figures derive from the immutable ledger; INR reporting currency with native amounts available (D-515)."
      />
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="statements">Partner statements</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <nav aria-label="Reports" className="rounded-lg border border-border bg-surface p-2">
              <ul className="space-y-0.5">
                {reports.map((r) => (
                  <li key={r.key}>
                    <button
                      type="button"
                      onClick={() => setKey(r.key)}
                      aria-current={r.key === key ? "page" : undefined}
                      className={cn(
                        "w-full rounded-sm px-3 py-2 text-left text-body-sm hover:bg-accent-soft",
                        r.key === key && "bg-accent-soft font-medium text-accent-text",
                      )}
                    >
                      {r.title}
                      {r.key === "revenue_by_partner" && !isSuperAdmin ? (
                        <span className="block text-caption text-fg-muted">own share only</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-h3">
                    {report.title}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-fg-subtle">
                          <InfoIcon aria-hidden className="size-4" />
                          <span className="sr-only">Formula</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{report.formula}</TooltipContent>
                    </Tooltip>
                  </h2>
                  <p className="text-body-sm text-fg-muted">{report.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast("CSV exported (audited)")}
                  >
                    <DownloadIcon aria-hidden /> Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast("Print stylesheet strips navigation and renders on white")}
                  >
                    <PrinterIcon aria-hidden /> Print
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div role="group" aria-label="Date range presets" className="flex flex-wrap gap-1">
                  {PRESETS.map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={preset === p ? "primary" : "outline"}
                      aria-pressed={preset === p}
                      onClick={() => setPreset(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
                {preset === "Custom" ? (
                  <>
                    <Field id="rp-from" label="From">
                      <Input id="rp-from" type="date" className="h-8 w-40" />
                    </Field>
                    <Field id="rp-to" label="To">
                      <Input id="rp-to" type="date" className="h-8 w-40" />
                    </Field>
                  </>
                ) : null}
                {key === "revenue_by_period" || key === "tax_collected" ? (
                  <Field id="rp-gran" label="Granularity">
                    <Select defaultValue="month">
                      <SelectTrigger id="rp-gran" size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="fy">FY</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                <Field id="rp-currency" label="Currency">
                  <Select defaultValue="inr">
                    <SelectTrigger id="rp-currency" size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inr">INR</SelectItem>
                      <SelectItem value="native">Native</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {key === "revenue_by_partner" || key === "outstanding_payouts" ? (
                  <Field id="rp-partner" label="Partner">
                    <Select
                      defaultValue={isSuperAdmin ? "all" : partners[0]?.id}
                      disabled={!isSuperAdmin}
                    >
                      <SelectTrigger id="rp-partner" size="sm" className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All partners</SelectItem>
                        {partners.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {report.tiles.map((t) => (
                  <StatTile
                    key={t.label}
                    label={t.label}
                    value={
                      t.label === "Products sold" || t.label === "Credit notes"
                        ? t.valueInr
                        : inr(t.valueInr)
                    }
                    delta={t.delta}
                  />
                ))}
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <BarChart
                  data={report.series}
                  formatValue={inr}
                  colourByBar={
                    key !== "revenue_by_period" && key !== "tax_collected" && key !== "refunds"
                  }
                  series={key === "refunds" ? 4 : 1}
                  height={180}
                  summary={`${report.title}: ${report.series.map((s) => `${s.label} ${inr(s.value)}`).join(", ")}.`}
                  caption={`${report.title} (INR)`}
                />
              </div>
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableCaption className="sr-only">{report.title}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      {report.columns.map((c, i) => (
                        <TableHead key={c} className={cn(i > 0 && "text-right")}>
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map((row, ri) => (
                      <TableRow key={ri}>
                        {row.map((cell, ci) => (
                          <TableCell
                            key={ci}
                            className={cn(
                              ci > 0 && "text-right font-mono tnum",
                              ci === 0 && "font-medium",
                            )}
                          >
                            {ci === 0 ? (
                              <button
                                type="button"
                                className="hover:text-accent-text hover:underline"
                                onClick={() => toast(`Drill down: ${String(cell)}`)}
                              >
                                {cell}
                              </button>
                            ) : (
                              cell
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                  {report.totals ? (
                    <TableFooter>
                      <TableRow>
                        {report.totals.map((cell, ci) => (
                          <TableCell key={ci} className={cn(ci > 0 && "text-right font-mono tnum")}>
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableFooter>
                  ) : null}
                </Table>
              </div>
              {key === "refunds" ? (
                <div className="rounded-lg border border-border bg-surface">
                  <h3 className="border-b border-border px-4 py-3 text-h4">
                    Customer credits (overpayments)
                  </h3>
                  <Table>
                    <TableCaption className="sr-only">Customer credits</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead>State</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerCredits.map((c) => (
                        <TableRow key={c.order}>
                          <TableCell className="font-mono">{c.order}</TableCell>
                          <TableCell className="font-mono text-fg-muted">{c.payment}</TableCell>
                          <TableCell className="text-right font-mono tnum">
                            {inr(c.credit.amountMinor)}
                          </TableCell>
                          <TableCell className="capitalize">{c.state}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
              <p className="text-caption text-fg-muted">
                INR equivalents use the rate stored on each entry at payment date.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="statements">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <form
              className="space-y-4 rounded-lg border border-border bg-surface p-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <h2 className="text-h4">Generate statement</h2>
              <Field id="st-partner" label="Partner" required>
                <Select value={stPartnerId} onValueChange={setStPartnerId} disabled={!isSuperAdmin}>
                  <SelectTrigger id="st-partner">
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
              <Field id="st-period" label="Period" required>
                <Select value={stPeriod} onValueChange={setStPeriod}>
                  <SelectTrigger id="st-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this">This month</SelectItem>
                    <SelectItem value="last">Last month</SelectItem>
                    <SelectItem value="fy">This FY</SelectItem>
                    <SelectItem value="custom">Custom (falls back to this month)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="st-format" label="Format">
                <Select value={stFormat} onValueChange={(v) => setStFormat(v as "pdf" | "csv")}>
                  <SelectTrigger id="st-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center gap-2">
                <Switch id="st-payouts" defaultChecked disabled />
                <Label htmlFor="st-payouts">Include payouts (always included)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="st-expenses" defaultChecked disabled />
                <Label htmlFor="st-expenses">Include expense shares (always included)</Label>
              </div>
              <Button
                type="submit"
                disabled={generating}
                onClick={() => void handleGenerateStatement()}
              >
                Generate
              </Button>
            </form>
            <div className="space-y-4">
              <section
                aria-label="Statement preview"
                className="rounded-lg border border-border bg-surface p-4 shadow-3"
              >
                <div className="mx-auto max-w-2xl rounded-md border border-border bg-canvas p-6">
                  <p className="text-overline tracking-wider text-fg-muted uppercase">
                    Partner statement
                  </p>
                  <h3 className="text-h3">{statement.partner}</h3>
                  <p className="text-body-sm text-fg-muted">{statement.period}</p>
                  <table className="mt-4 w-full text-body-sm">
                    <caption className="sr-only">Statement lines</caption>
                    <tbody>
                      <tr className="border-b border-border">
                        <th scope="row" className="py-1.5 text-left font-medium">
                          Opening balance
                        </th>
                        <td className="text-right font-mono tnum">{inr(statement.opening)}</td>
                      </tr>
                      {statement.allocations.map((a) => (
                        <tr key={a.order}>
                          <th scope="row" className="py-1 pl-4 text-left font-normal text-fg-muted">
                            Allocation · {a.order}
                          </th>
                          <td className="text-right font-mono tnum">+{inr(a.amount)}</td>
                        </tr>
                      ))}
                      <tr>
                        <th scope="row" className="py-1 text-left font-normal">
                          Refund reversals
                        </th>
                        <td className="text-right font-mono tnum text-danger">
                          −{inr(-statement.refunds)}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row" className="py-1 text-left font-normal">
                          Expense shares
                        </th>
                        <td className="text-right font-mono tnum text-danger">
                          −{inr(-statement.expenseShares)}
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <th scope="row" className="py-1 text-left font-normal">
                          Payouts
                        </th>
                        <td className="text-right font-mono tnum">{inr(statement.payouts)}</td>
                      </tr>
                      <tr>
                        <th scope="row" className="py-2 text-left font-semibold">
                          Closing balance
                        </th>
                        <td className="text-right font-mono text-body font-semibold tnum">
                          {inr(statement.closing)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-4 text-caption text-fg-subtle">
                    Generated by CodeKraft admin on 25 Sep 2026 · figures from immutable ledger. PDF
                    renders ink-on-white regardless of theme.
                  </p>
                </div>
              </section>
              <section
                aria-label="Generated statements"
                className="rounded-lg border border-border bg-surface"
              >
                <Table>
                  <TableCaption className="sr-only">Generated statements</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Generated by / at</TableHead>
                      <TableHead>Download</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statementHistory.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.partner}</TableCell>
                        <TableCell>{s.period}</TableCell>
                        <TableCell>{s.format}</TableCell>
                        <TableCell className="text-fg-muted">
                          {s.generatedBy} · {formatDateTime(s.generatedAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => toast("Link expired — regenerate")}
                          >
                            Regenerate (5-min link)
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
