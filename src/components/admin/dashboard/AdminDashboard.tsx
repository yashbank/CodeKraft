"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  LayoutGridIcon,
  PlusIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  refreshDashboardWidget,
  saveDashboardWidgets,
} from "@/modules/dashboard-widgets/admin-mutations";
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
import { BarChart, StackedBarChart, type BarVariant } from "../charts/BarChart";
import { DonutChart, type DonutVariant } from "../charts/DonutChart";
import { LineChart, type LineVariant } from "../charts/LineChart";
import type { GaugeVariant } from "../charts/Gauge";
import type { SparklineVariant } from "../charts/Sparkline";
import {
  isWidgetStyle,
  resolveWidgetStyle,
  stylesFor,
} from "@/modules/dashboard-widgets/widget-styles";
import { WidgetSkeleton } from "./WidgetSkeleton";
import { dashboardRangeBounds, ledgerDrillHref } from "@/lib/admin/drill-links";
import { AnimatedNumber } from "../use-count-up";
import { Funnel } from "../charts/Funnel";
import { Gauge } from "../charts/Gauge";
import { Sparkline } from "../charts/Sparkline";
import { EmptyState } from "../EmptyState";
import { compactNumber, inr, plainNumber } from "../format";
import { PageHeader } from "../PageHeader";
import type { DashboardData, ProductStatus, WidgetKey } from "../types";
import { LIST_CLASS, QueueList } from "./QueueList";
import { WIDGET_LIBRARY, type WidgetDefinition } from "./widget-library";
import { defaultLayoutFor } from "./role-widgets";
import { WidgetFrame } from "./WidgetFrame";

const lakh = (paise: number) => `₹${(paise / 10000000).toFixed(1)}L`;

export interface AdminDashboardProps {
  data: DashboardData;
  /** Widget keys in display order (saved layout); defaults to the new-admin layout. */
  layout?: WidgetKey[];
  /** Widgets this role may use (P14-01); defaults to the whole library. */
  allowed?: readonly WidgetKey[];
  /** Saved visual style per widget (P14-09); unknown or missing -> the kind's default. */
  styles?: Partial<Record<WidgetKey, string>>;
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
  data: serverData,
  layout,
  allowed: allowedProp,
  styles: stylesProp,
  isSuperAdmin,
  greeting,
  dateLabel,
  routes,
}: AdminDashboardProps) {
  const href = (route: string) => routes?.[route] ?? route;
  const router = useRouter();
  const pathname = usePathname();
  const library = React.useMemo(
    () => WIDGET_LIBRARY.filter((w) => !allowedProp || allowedProp.includes(w.key)),
    [allowedProp],
  );
  const defaultLayout = defaultLayoutFor(library.map((w) => w.key));
  const [enabled, setEnabled] = React.useState<WidgetKey[]>(layout ?? defaultLayout);
  const [styles, setStyles] = React.useState<Partial<Record<WidgetKey, string>>>(stylesProp ?? {});
  const [editing, setEditing] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const range = serverData.range;
  // Per-widget refresh results are layered over the server-rendered data; a new server render
  // (range change, router.refresh) supersedes them.
  const [overrides, setOverrides] = React.useState<Partial<DashboardData>>({});
  const [refreshing, setRefreshing] = React.useState<ReadonlySet<WidgetKey>>(new Set());
  React.useEffect(() => setOverrides({}), [serverData]);
  const data: DashboardData = { ...serverData, ...overrides };

  const refreshWidget = async (key: WidgetKey, title: string) => {
    if (refreshing.has(key)) return;
    setRefreshing((prev) => new Set(prev).add(key));
    try {
      const res = await refreshDashboardWidget({ widget: key, range });
      if (res.ok) setOverrides((prev) => ({ ...prev, ...res.data.data }));
      else toast.error(`Couldn't refresh ${title}`, { description: res.error.message });
    } catch (err) {
      toast.error(`Couldn't refresh ${title}`, {
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };
  // Saves are sequenced so a slow earlier request can never overwrite a newer layout.
  const saveChain = React.useRef<Promise<unknown>>(Promise.resolve());

  /** R8-10 — every layout change is persisted to the admin's own `dashboard_layouts` row. */
  const persist = (next: WidgetKey[], nextStyles = styles) => {
    setEnabled(next);
    setStyles(nextStyles);
    // Only a valid, explicitly picked style is stored; bare ids keep the old array-of-ids shape.
    const widgets = next.map((id) => {
      const style = nextStyles[id];
      return isWidgetStyle(id, style) ? { id, style } : id;
    });
    saveChain.current = saveChain.current.then(async () => {
      const res = await saveDashboardWidgets({ widgets });
      if (!res.ok)
        toast.error("Couldn't save your dashboard layout", { description: res.error.message });
    });
  };

  const setRange = (next: DashboardData["range"]) => {
    router.push(`${pathname}?range=${next}`);
  };

  const move = (key: WidgetKey, delta: -1 | 1) => {
    const visible = definitions.map((d) => d.key);
    const idx = visible.indexOf(key);
    const swapWith = visible[idx + delta];
    if (idx < 0 || !swapWith) return;
    const next = [...enabled];
    const a = next.indexOf(key);
    const b = next.indexOf(swapWith);
    [next[a], next[b]] = [next[b] as WidgetKey, next[a] as WidgetKey];
    persist(next);
  };
  const rangeLabel = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    fy: "This FY",
  }[range];

  const toggle = (key: WidgetKey, on: boolean) => {
    persist(
      on ? (enabled.includes(key) ? enabled : [...enabled, key]) : enabled.filter((k) => k !== key),
    );
    // The server render only loaded data for widgets already enabled; fetch it for a new one.
    if (on && !enabled.includes(key)) {
      const title = WIDGET_LIBRARY.find((w) => w.key === key)?.title ?? key;
      void refreshWidget(key, title);
    }
  };

  const definitions = enabled
    .map((k) => library.find((w) => w.key === k))
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
              onClick={() => setEditing((v) => !v)}
            >
              <LayoutGridIcon aria-hidden /> {editing ? "Done" : "Edit layout"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => persist(defaultLayout)}>
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
              <Button size="sm" variant="secondary" onClick={() => persist(defaultLayout)}>
                Use default layout
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12" aria-live="polite">
          {definitions.map((def, index) => (
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
              onRefresh={() => void refreshWidget(def.key, def.title)}
              refreshing={refreshing.has(def.key)}
              onMoveUp={index > 0 ? () => move(def.key, -1) : undefined}
              onMoveDown={index < definitions.length - 1 ? () => move(def.key, 1) : undefined}
              viewAllHref={VIEW_ALL[def.key] ? href(VIEW_ALL[def.key] as string) : undefined}
              styleName={resolveWidgetStyle(def.key, styles[def.key])}
            >
              {refreshing.has(def.key) ? (
                <WidgetSkeleton />
              ) : (
                <WidgetBody widget={def.key} data={data} style={styles[def.key]} />
              )}
            </WidgetFrame>
          ))}
        </div>
      )}

      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent className="overflow-y-auto lg:w-[560px]">
          <SheetHeader>
            <SheetTitle>Widget library</SheetTitle>
            <SheetDescription>
              {library.length} widgets. Toggle to add or remove; widgets you lack permission for are
              disabled.
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
            )
              .filter((group) => library.some((w) => w.group === group))
              .map((group) => (
                <section key={group} aria-labelledby={`lib-${group}`}>
                  <h3
                    id={`lib-${group}`}
                    className="mb-2 text-overline tracking-wider text-fg-muted uppercase"
                  >
                    {group}
                  </h3>
                  <ul className="space-y-2">
                    {library
                      .filter((w) => w.group === group)
                      .map((w) => {
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
                              {on && !blocked ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <Label
                                    htmlFor={`style-${w.key}`}
                                    className="text-caption text-fg-muted"
                                  >
                                    Style
                                  </Label>
                                  <Select
                                    value={resolveWidgetStyle(w.key, styles[w.key])}
                                    onValueChange={(v) =>
                                      persist(enabled, { ...styles, [w.key]: v })
                                    }
                                  >
                                    <SelectTrigger
                                      id={`style-${w.key}`}
                                      size="sm"
                                      aria-label={`${w.title} style`}
                                      className="w-40"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {stylesFor(w.key).map((st) => (
                                        <SelectItem key={st} value={st}>
                                          {st}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : null}
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

function Stat({
  value,
  count,
  delta,
  hint,
  variant = "plain",
}: {
  value: string;
  /** Raw number behind `value`: counts up on first view instead of showing `value` directly. */
  count?: number;
  delta?: string;
  hint?: string;
  /** P14-09 style: only frame/size/delta treatment changes, the numbers always render. */
  variant?: string;
}) {
  return (
    <div
      data-variant={variant}
      className={cn(
        variant === "accent-bar" && "border-l-4 border-accent pl-3",
        variant === "outlined" && "rounded-md border border-border p-3",
        variant === "tinted" && "rounded-md bg-accent-soft p-3",
      )}
    >
      <div
        className={cn(
          "leading-tight font-semibold tnum",
          variant === "big-number" ? "text-[44px]" : "text-[28px]",
        )}
      >
        {count !== undefined ? <AnimatedNumber value={count} format={inr} /> : value}
      </div>
      {delta ? (
        <div
          className={cn(
            "text-caption font-medium",
            variant === "trend-badge" && "mt-1 inline-block rounded-full bg-elevated px-2 py-0.5",
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

export const NO_DATA_TEXT = "No data yet";

function NoData({ text = NO_DATA_TEXT }: { text?: string }) {
  return (
    <p data-empty className="py-6 text-center text-body-sm text-fg-subtle">
      {text}
    </p>
  );
}

const hasValues = (rows: ReadonlyArray<{ value: number }>) => rows.some((r) => r.value !== 0);

export function WidgetBody({
  widget,
  data,
  style,
}: {
  widget: WidgetKey;
  data: DashboardData;
  /** Saved style; invalid or missing falls back to the widget kind's default (P14-09). */
  style?: string;
}) {
  const v = resolveWidgetStyle(widget, style);
  switch (widget) {
    case "revenue_by_period":
      if (!hasValues(data.revenueByPeriod)) return <NoData />;
      return (
        <LineChart
          data={data.revenueByPeriod}
          variant={v as LineVariant}
          formatValue={inr}
          summary={`Revenue by period: ${data.revenueByPeriod.map((d) => `${d.label} ${lakh(d.value)}`).join(", ")}.`}
          caption="Revenue by period (INR)"
        />
      );
    case "revenue_by_product":
      if (!hasValues(data.revenueByProduct)) return <NoData />;
      return (
        <BarChart
          data={data.revenueByProduct.map((d) => ({
            ...d,
            href: d.id
              ? ledgerDrillHref({ product: d.id, ...dashboardRangeBounds(data.range) })
              : undefined,
          }))}
          formatValue={inr}
          colourByBar
          variant={v as BarVariant}
          summary={`Revenue by product, highest ${data.revenueByProduct[0]?.label ?? "—"}.`}
          caption="Revenue by product (INR)"
        />
      );
    case "revenue_by_partner":
      if (!hasValues(data.revenueByPartner)) return <NoData />;
      return (
        <BarChart
          data={data.revenueByPartner}
          formatValue={inr}
          colourByBar
          variant={v as BarVariant}
          summary="Revenue by partner."
          caption="Revenue by partner (INR)"
        />
      );
    case "my_share":
      return (
        <div className="flex items-end justify-between gap-3">
          <Stat
            value={inr(data.myShare.valueInr)}
            count={data.myShare.valueInr}
            delta={data.myShare.delta}
            hint="Your allocations, net of refunds"
          />
          {data.myShare.sparkline.length > 1 ? (
            <Sparkline
              points={data.myShare.sparkline}
              label="Weekly share trend"
              series={2}
              variant={v as SparklineVariant}
            />
          ) : null}
        </div>
      );
    case "outstanding_payouts":
      return (
        <>
          <Stat
            value={inr(data.outstandingPayouts.totalInr)}
            count={data.outstandingPayouts.totalInr}
            hint="Across all partners"
            variant={v}
          />
          <QueueList items={data.outstandingPayouts.items} empty="Nothing outstanding" />
        </>
      );
    case "expenses_vs_profit":
      if (!data.expensesVsProfit.some((d) => d.expenses !== 0 || d.profit !== 0)) return <NoData />;
      return (
        <StackedBarChart
          data={data.expensesVsProfit.map((d) => ({ label: d.label, a: d.expenses, b: d.profit }))}
          seriesLabels={["Expenses", "Profit"]}
          variant={v as BarVariant}
          formatValue={inr}
          summary="Expenses versus profit per month."
          caption="Expenses vs profit (INR)"
        />
      );
    case "payments_awaiting":
      return (
        <QueueList
          items={data.paymentsAwaiting}
          empty="No payments awaiting confirmation"
          variant={v}
        />
      );
    case "publish_approvals":
      return (
        <QueueList items={data.publishApprovals} empty="No publish approvals pending" variant={v} />
      );
    case "split_approvals":
      return (
        <QueueList items={data.splitApprovals} empty="No split approvals pending" variant={v} />
      );
    case "service_checklists":
      return (
        <QueueList items={data.serviceChecklists} empty="No service checklists due" variant={v} />
      );
    case "revocation_tasks":
      return <QueueList items={data.revocationTasks} empty="No revocation tasks" variant={v} />;
    case "new_leads":
      return (
        <>
          <Stat value={String(data.newLeads.count)} delta={data.newLeads.delta} variant={v} />
          <QueueList items={data.newLeads.items} empty="No new leads" />
        </>
      );
    case "pipeline_funnel":
      if (!hasValues(data.funnel)) return <NoData text="No leads in the pipeline yet" />;
      return (
        <Funnel stages={data.funnel} caption="Leads per pipeline stage" variant={v as BarVariant} />
      );
    case "overdue_follow_ups":
      return <QueueList items={data.overdueFollowUps} empty="No overdue follow-ups" variant={v} />;
    case "conversion_rate":
      return (
        <Stat
          value={`${Math.round(data.conversionRate.value * 100)} %`}
          delta={data.conversionRate.delta}
          hint="Won ÷ closed"
          variant={v}
        />
      );
    case "open_queries":
      return (
        <QueueList items={data.openQueries} empty="Inbox zero — no open queries" variant={v} />
      );
    case "visits_top_products":
      return (
        <>
          <Stat
            value={plainNumber(data.visits.total)}
            delta={data.visits.delta}
            hint="Visits (Umami)"
            variant={v}
          />
          {data.visits.top.length === 0 ? <NoData text="No product views yet" /> : null}
          <Table className={data.visits.top.length === 0 ? "hidden" : undefined}>
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
            variant={v as GaugeVariant}
          />
          <Gauge
            value={data.chatbotUsage.usersAtCap}
            max={10}
            label={`Users at the ${data.chatbotUsage.perUserCap}/day cap`}
            variant={v as GaugeVariant}
          />
        </div>
      );
    case "catalog_status":
      if (data.catalogStatus.length === 0) return <NoData text="No products yet" />;
      return (
        <DonutChart
          data={data.catalogStatus.map((c) => ({ label: c.status, value: c.count }))}
          variant={v as DonutVariant}
          legendLabel={(d) => (
            <StatusBadge kind="products.status" value={d.label as ProductStatus} size="sm" />
          )}
          summary={`Products per status: ${data.catalogStatus.map((c) => `${c.status} ${c.count}`).join(", ")}.`}
        />
      );
    case "new_customers":
      return (
        <div className="flex items-end justify-between gap-3">
          <Stat value={String(data.newCustomers.count)} delta={data.newCustomers.delta} />
          {data.newCustomers.sparkline.length > 1 ? (
            <Sparkline
              points={data.newCustomers.sparkline}
              label="Daily sign-ups"
              series={6}
              variant={v as SparklineVariant}
            />
          ) : null}
        </div>
      );
    case "system_health":
      if (data.systemHealth.length === 0) return <NoData text="Health checks unavailable" />;
      return (
        <ul data-variant={v} className={cn("space-y-1.5", LIST_CLASS[v])}>
          {data.systemHealth.map((h) => {
            const status = h.status ?? (h.ok ? "ok" : "fail");
            const Icon =
              status === "ok"
                ? CheckCircle2Icon
                : status === "warn"
                  ? TriangleAlertIcon
                  : XCircleIcon;
            return (
              <li key={h.label} className="flex items-start gap-2 text-body-sm">
                <Icon
                  aria-hidden
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    status === "ok"
                      ? "text-success"
                      : status === "warn"
                        ? "text-warning"
                        : "text-danger",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{h.label}</span>
                  <span
                    className={cn(
                      "block break-words font-mono text-caption",
                      status === "ok"
                        ? "text-fg-muted"
                        : status === "warn"
                          ? "text-warning"
                          : "text-danger",
                    )}
                  >
                    {status} · {h.detail}
                    {h.checkedAt
                      ? ` · ${new Date(h.checkedAt).toISOString().slice(11, 16)} UTC`
                      : ""}
                  </span>
                </span>
              </li>
            );
          })}
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
