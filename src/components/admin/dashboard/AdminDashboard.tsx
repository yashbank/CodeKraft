"use client";

import * as React from "react";
import { CheckCircle2Icon, LayoutGridIcon, PlusIcon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { cn } from "@/components/ui/_utils";
import { BarChart, StackedBarChart } from "../charts/BarChart";
import { Funnel } from "../charts/Funnel";
import { Gauge } from "../charts/Gauge";
import { Sparkline } from "../charts/Sparkline";
import { EmptyState } from "../EmptyState";
import { compactNumber, inr, plainNumber } from "../format";
import { PageHeader } from "../PageHeader";
import type { DashboardData, WidgetKey } from "../types";
import { QueueList } from "./QueueList";
import { DEFAULT_LAYOUT, WIDGET_LIBRARY, type WidgetDefinition } from "./widget-library";
import { WidgetFrame } from "./WidgetFrame";

const lakh = (paise: number) => `₹${(paise / 10000000).toFixed(1)}L`;

export interface AdminDashboardProps {
  data: DashboardData;
  /** Widget keys in display order (saved layout); defaults to the new-admin layout. */
  layout?: WidgetKey[];
  isSuperAdmin: boolean;
  greeting: string;
  dateLabel: string;
  routes?: Record<string, string>;
}

/**
 * SCR-ADM-02 — widget dashboard on a static 12-column grid (react-grid-layout replaces it in
 * Phase 8 with the same `WidgetFrame` cards). "Customise" opens the widget library sheet with
 * toggles; "Edit layout" shows the drag handles; "Reset" restores the default layout.
 */
export function AdminDashboard({
  data,
  layout,
  isSuperAdmin,
  greeting,
  dateLabel,
  routes,
}: AdminDashboardProps) {
  const href = (route: string) => routes?.[route] ?? route;
  const [enabled, setEnabled] = React.useState<WidgetKey[]>(layout ?? DEFAULT_LAYOUT);
  const [editing, setEditing] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [range, setRange] = React.useState<DashboardData["range"]>(data.range);
  const rangeLabel = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    fy: "This FY",
  }[range];

  const toggle = (key: WidgetKey, on: boolean) =>
    setEnabled((prev) =>
      on ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key),
    );

  const definitions = enabled
    .map((k) => WIDGET_LIBRARY.find((w) => w.key === k))
    .filter((w): w is WidgetDefinition => Boolean(w) && !(w?.superAdminOnly && !isSuperAdmin));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${greeting} · ${dateLabel}`}
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label htmlFor="dash-range" className="sr-only">
                Range
              </Label>
              <Select value={range} onValueChange={(v) => setRange(v as DashboardData["range"])}>
                <SelectTrigger id="dash-range" size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="fy">This FY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setLibraryOpen(true)}>
              <PlusIcon aria-hidden /> Customise
            </Button>
            <Button
              variant={editing ? "primary" : "outline"}
              size="sm"
              aria-pressed={editing}
              onClick={() => {
                if (editing) toast.success("Layout saved");
                setEditing((v) => !v);
              }}
            >
              <LayoutGridIcon aria-hidden /> {editing ? "Done" : "Edit layout"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEnabled(DEFAULT_LAYOUT)}>
              Reset to default
            </Button>
          </>
        }
      />

      {definitions.length === 0 ? (
        <EmptyState
          icon={LayoutGridIcon}
          title="Build your dashboard"
          body="Pick widgets from the library or start with the default layout."
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setLibraryOpen(true)}>
                Add widget
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEnabled(DEFAULT_LAYOUT)}>
                Use default layout
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12" aria-live="polite">
          {definitions.map((def) => (
            <WidgetFrame
              key={def.key}
              id={def.key}
              title={def.title}
              colSpan={def.colSpan}
              rowSpan={def.rowSpan}
              rangeChip={
                [
                  "revenue_by_period",
                  "revenue_by_product",
                  "revenue_by_partner",
                  "my_share",
                  "expenses_vs_profit",
                  "conversion_rate",
                  "visits_top_products",
                  "new_customers",
                ].includes(def.key)
                  ? rangeLabel
                  : undefined
              }
              editing={editing}
              onRemove={() => toggle(def.key, false)}
              viewAllHref={VIEW_ALL[def.key] ? href(VIEW_ALL[def.key] as string) : undefined}
            >
              <WidgetBody widget={def.key} data={data} />
            </WidgetFrame>
          ))}
        </div>
      )}

      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent className="overflow-y-auto lg:w-[560px]">
          <SheetHeader>
            <SheetTitle>Widget library</SheetTitle>
            <SheetDescription>
              {WIDGET_LIBRARY.length} widgets. Toggle to add or remove; widgets you lack permission
              for are disabled.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-6">
            {(
              [
                "Sales & revenue",
                "Operations",
                "Leads & queries",
                "Traffic",
                "Catalog & customers",
                "System & AI",
              ] as const
            ).map((group) => (
              <section key={group} aria-labelledby={`lib-${group}`}>
                <h3
                  id={`lib-${group}`}
                  className="mb-2 text-overline tracking-wider text-fg-muted uppercase"
                >
                  {group}
                </h3>
                <ul className="space-y-2">
                  {WIDGET_LIBRARY.filter((w) => w.group === group).map((w) => {
                    const blocked = Boolean(w.superAdminOnly && !isSuperAdmin);
                    const on = enabled.includes(w.key);
                    return (
                      <li
                        key={w.key}
                        className={cn(
                          "flex items-start gap-3 rounded-md border border-border bg-surface p-3",
                          blocked && "opacity-60",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <Label htmlFor={`lib-${w.key}`} className="text-body-sm">
                            {w.title}
                          </Label>
                          <p className="text-caption text-fg-muted">{w.description}</p>
                          <p className="font-mono text-caption text-fg-subtle">
                            requires {w.requiredPermission}
                            {blocked ? " · not permitted" : ""}
                          </p>
                        </div>
                        <Switch
                          id={`lib-${w.key}`}
                          checked={on}
                          disabled={blocked}
                          onCheckedChange={(v) => toggle(w.key, v)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

const VIEW_ALL: Partial<Record<WidgetKey, string>> = {
  payments_awaiting: "/orders",
  publish_approvals: "/approvals",
  split_approvals: "/approvals",
  service_checklists: "/orders",
  revocation_tasks: "/delivery-tasks",
  new_leads: "/leads",
  overdue_follow_ups: "/leads",
  open_queries: "/queries",
  outstanding_payouts: "/finance/partners",
  chatbot_usage: "/chatbot",
  catalog_status: "/products",
  revenue_by_period: "/finance/reports",
  revenue_by_product: "/finance/reports",
  revenue_by_partner: "/finance/reports",
  expenses_vs_profit: "/finance/expenses",
};

function Stat({ value, delta, hint }: { value: string; delta?: string; hint?: string }) {
  return (
    <div>
      <div className="text-[28px] leading-tight font-semibold tnum">{value}</div>
      {delta ? (
        <div
          className={cn(
            "text-caption font-medium",
            delta.startsWith("+")
              ? "text-success"
              : delta.startsWith("-")
                ? "text-danger"
                : "text-fg-muted",
          )}
        >
          {delta}
        </div>
      ) : null}
      {hint ? <div className="text-caption text-fg-muted">{hint}</div> : null}
    </div>
  );
}

function WidgetBody({ widget, data }: { widget: WidgetKey; data: DashboardData }) {
  switch (widget) {
    case "revenue_by_period":
      return (
        <BarChart
          data={data.revenueByPeriod}
          formatValue={inr}
          summary={`Revenue by period: ${data.revenueByPeriod.map((d) => `${d.label} ${lakh(d.value)}`).join(", ")}.`}
          caption="Revenue by period (INR)"
        />
      );
    case "revenue_by_product":
      return (
        <BarChart
          data={data.revenueByProduct}
          formatValue={inr}
          colourByBar
          summary={`Revenue by product, highest ${data.revenueByProduct[0]?.label ?? "—"}.`}
          caption="Revenue by product (INR)"
        />
      );
    case "revenue_by_partner":
      return (
        <BarChart
          data={data.revenueByPartner}
          formatValue={inr}
          colourByBar
          summary="Revenue by partner."
          caption="Revenue by partner (INR)"
        />
      );
    case "my_share":
      return (
        <div className="flex items-end justify-between gap-3">
          <Stat
            value={inr(data.myShare.valueInr)}
            delta={data.myShare.delta}
            hint="Your allocations, net of refunds"
          />
          <Sparkline points={data.myShare.sparkline} label="Weekly share trend" series={2} />
        </div>
      );
    case "outstanding_payouts":
      return (
        <>
          <Stat value={inr(data.outstandingPayouts.totalInr)} hint="Across all partners" />
          <QueueList items={data.outstandingPayouts.items} empty="Nothing outstanding" />
        </>
      );
    case "expenses_vs_profit":
      return (
        <StackedBarChart
          data={data.expensesVsProfit.map((d) => ({ label: d.label, a: d.expenses, b: d.profit }))}
          seriesLabels={["Expenses", "Profit"]}
          formatValue={inr}
          summary="Expenses versus profit per month."
          caption="Expenses vs profit (INR)"
        />
      );
    case "payments_awaiting":
      return <QueueList items={data.paymentsAwaiting} empty="No payments awaiting confirmation" />;
    case "publish_approvals":
      return <QueueList items={data.publishApprovals} empty="No publish approvals pending" />;
    case "split_approvals":
      return <QueueList items={data.splitApprovals} empty="No split approvals pending" />;
    case "service_checklists":
      return <QueueList items={data.serviceChecklists} empty="No service checklists due" />;
    case "revocation_tasks":
      return <QueueList items={data.revocationTasks} empty="No revocation tasks" />;
    case "new_leads":
      return (
        <>
          <Stat value={String(data.newLeads.count)} delta={data.newLeads.delta} />
          <QueueList items={data.newLeads.items} empty="No new leads" />
        </>
      );
    case "pipeline_funnel":
      return <Funnel stages={data.funnel} caption="Leads per pipeline stage" />;
    case "overdue_follow_ups":
      return <QueueList items={data.overdueFollowUps} empty="No overdue follow-ups" />;
    case "conversion_rate":
      return (
        <Stat
          value={`${Math.round(data.conversionRate.value * 100)} %`}
          delta={data.conversionRate.delta}
          hint="Won ÷ closed"
        />
      );
    case "open_queries":
      return <QueueList items={data.openQueries} empty="Inbox zero — no open queries" />;
    case "visits_top_products":
      return (
        <>
          <Stat
            value={plainNumber(data.visits.total)}
            delta={data.visits.delta}
            hint="Visits (Umami)"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Visits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.visits.top.map((t) => (
                <TableRow key={t.product} className="h-9">
                  <TableCell>{t.product}</TableCell>
                  <TableCell className="text-right font-mono tnum">
                    {plainNumber(t.visits)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      );
    case "chatbot_usage":
      return (
        <div className="space-y-3">
          <Gauge
            value={data.chatbotUsage.platform}
            max={data.chatbotUsage.platformCap}
            label="Platform messages today"
            format={plainNumber}
          />
          <Gauge
            value={data.chatbotUsage.usersAtCap}
            max={10}
            label={`Users at the ${data.chatbotUsage.perUserCap}/day cap`}
          />
        </div>
      );
    case "catalog_status":
      return (
        <ul className="flex flex-wrap gap-2">
          {data.catalogStatus.map((c) => (
            <li
              key={c.status}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1"
            >
              <StatusBadge kind="products.status" value={c.status} size="sm" />
              <span className="font-mono text-body-sm tnum">{c.count}</span>
            </li>
          ))}
        </ul>
      );
    case "new_customers":
      return (
        <div className="flex items-end justify-between gap-3">
          <Stat value={String(data.newCustomers.count)} delta={data.newCustomers.delta} />
          <Sparkline points={data.newCustomers.sparkline} label="Daily sign-ups" series={6} />
        </div>
      );
    case "system_health":
      return (
        <ul className="space-y-1.5">
          {data.systemHealth.map((h) => (
            <li key={h.label} className="flex items-center gap-2 text-body-sm">
              {h.ok ? (
                <CheckCircle2Icon aria-hidden className="size-4 text-success" />
              ) : (
                <XCircleIcon aria-hidden className="size-4 text-danger" />
              )}
              <span className="flex-1">{h.label}</span>
              <span
                className={cn("font-mono text-caption", h.ok ? "text-fg-muted" : "text-danger")}
              >
                {h.ok ? "ok" : "error"} · {h.detail}
              </span>
            </li>
          ))}
          <li className="pt-1 text-caption text-fg-muted">
            {compactNumber(data.visits.total)} visits in range · cron runs listed in Settings ›
            Retention
          </li>
        </ul>
      );
    default:
      return null;
  }
}
