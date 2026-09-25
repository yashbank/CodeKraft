"use client";

import { PackageOpenIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/components/ui/_utils";
import { format } from "@/lib/money";
import { DELIVERY_LABELS } from "./DeliveryTypeIcon";
import { EmptyState } from "./EmptyState";
import { EntitlementCard } from "./EntitlementCard";
import { formatDate } from "./format";
import type { DeliveryType, EntitlementSummary, OrderView } from "./types";

const FILTERS: { key: DeliveryType | "subscription"; label: string }[] = [
  { key: "download", label: "Download" },
  { key: "license", label: "License" },
  { key: "hosted", label: "Hosted" },
  { key: "saas", label: "SaaS" },
  { key: "service", label: "Product + service" },
  { key: "custom", label: "Custom" },
  { key: "subscription", label: "Subscription" },
];

function orderAction(o: OrderView): string {
  if (o.status === "pending_payment") {
    if (o.payment?.status === "initiated") return "Submit reference";
    if (o.payment?.status === "failed") return "Retry payment";
    return "Pay now";
  }
  return "View";
}

/** SCR-ACC-02 `OrderRow`: order no, date, product/offering, total, status, action. */
export function OrderRow({ order: o, href }: { order: OrderView; href: string }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-body-sm text-fg">{o.number}</span>
          <StatusBadge kind="orders.status" value={o.status} size="sm" />
        </div>
        <p className="text-body-sm text-fg-muted">
          {o.productName} · {o.offeringName}
        </p>
        <p className="text-caption text-fg-subtle">Placed {formatDate(o.placedAt)}</p>
      </div>
      <span className="font-mono text-body tnum text-fg">{format(o.total)}</span>
      <Button
        size="sm"
        variant={o.status === "pending_payment" ? "primary" : "secondary"}
        className="w-full sm:w-auto"
        asChild
      >
        <Link href={href}>{orderAction(o)}</Link>
      </Button>
    </article>
  );
}

/** SCR-ACC-02 — purchases & access: Active · Pending & past orders · Expired & revoked. */
export function PurchasesScreen({
  entitlements,
  orders,
  now: _now,
  links,
  loading = false,
  error,
}: {
  entitlements: EntitlementSummary[];
  orders: OrderView[];
  now: string;
  links: { entitlement: (id: string) => string; order: (id: string) => string };
  loading?: boolean;
  error?: string | null;
}) {
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<DeliveryType | "subscription" | null>(null);

  const matches = (e: EntitlementSummary) =>
    (!search || e.productName.toLowerCase().includes(search.toLowerCase())) &&
    (!filter || (filter === "subscription" ? !!e.subscription : e.deliveryType === filter));
  const active = entitlements.filter(
    (e) =>
      (e.status === "active" || e.status === "suspended" || e.status === "pending") && matches(e),
  );
  const past = entitlements.filter(
    (e) => (e.status === "expired" || e.status === "revoked") && matches(e),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-fg">Purchases &amp; access</h1>
      {error ? (
        <div
          role="alert"
          className="rounded-md border-l-4 border-danger bg-danger-soft p-4 text-body-sm text-danger"
        >
          {error}{" "}
          <Button size="sm" variant="secondary" className="ml-2">
            Try again
          </Button>
        </div>
      ) : null}
      <Tabs defaultValue="active">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="orders">Pending &amp; past orders</TabsTrigger>
          <TabsTrigger value="past">Expired &amp; revoked</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs sm:flex-1">
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
            />
            <Input
              aria-label="Search by product name"
              placeholder="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div
            role="group"
            aria-label="Filter by delivery type"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(on ? null : f.key)}
                  className={cn(
                    "h-8 shrink-0 rounded-full border px-3 text-caption font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    on
                      ? "border-accent bg-accent-soft text-accent-text"
                      : "border-border bg-surface text-fg-muted hover:text-fg",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <TabsContent value="active" className="mt-4">
          {loading ? (
            <RowsSkeleton />
          ) : active.length === 0 ? (
            <EmptyState
              icon={PackageOpenIcon}
              title="No purchases yet"
              body={filter || search ? "Nothing matches these filters." : undefined}
              action={
                filter || search ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setFilter(null);
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" asChild>
                    <Link href="/products">Explore products</Link>
                  </Button>
                )
              }
            />
          ) : (
            <ul className="space-y-3">
              {active.map((e) => (
                <li key={e.id}>
                  <EntitlementCard entitlement={e} detailHref={links.entitlement(e.id)} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          {loading ? (
            <RowsSkeleton />
          ) : orders.length === 0 ? (
            <EmptyState icon={PackageOpenIcon} title="No open orders" />
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li key={o.id}>
                  <OrderRow order={o} href={links.order(o.id)} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {loading ? (
            <RowsSkeleton />
          ) : past.length === 0 ? (
            <EmptyState icon={PackageOpenIcon} title="Nothing here" />
          ) : (
            <ul className="space-y-3">
              {past.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-semibold text-fg">{e.productName}</span>
                      <StatusBadge kind="entitlements.status" value={e.status} size="sm" />
                    </div>
                    <p className="text-body-sm text-fg-muted">
                      {e.offeringName} · {DELIVERY_LABELS[e.deliveryType]} · {e.accessLabel}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" className="w-full sm:w-auto" asChild>
                    <Link href={links.entitlement(e.id)}>
                      {e.status === "revoked"
                        ? "Contact support"
                        : e.subscription
                          ? "Renew"
                          : "Buy again"}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}
