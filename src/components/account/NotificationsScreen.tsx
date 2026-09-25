"use client";

import {
  BellOffIcon,
  KeyRoundIcon,
  MessageSquareIcon,
  PackageIcon,
  RefreshCwIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/components/ui/_utils";
import { EmptyState } from "./EmptyState";
import { dayLabel, formatDateTime, relativeTime } from "./format";
import type { NotificationItem, NotificationType } from "./types";

const TYPES: { key: NotificationType; label: string; Icon: LucideIcon }[] = [
  { key: "orders", label: "Orders", Icon: PackageIcon },
  { key: "delivery", label: "Delivery", Icon: KeyRoundIcon },
  { key: "renewals", label: "Renewals", Icon: RefreshCwIcon },
  { key: "queries", label: "Queries", Icon: MessageSquareIcon },
  { key: "product_updates", label: "Product updates", Icon: SparklesIcon },
];

/** SCR-ACC-08 — notification inbox grouped by day, All/Unread tabs, type chips, mark all read. */
export function NotificationsScreen({
  items: initial,
  now,
  links,
  loading = false,
}: {
  items: NotificationItem[];
  now: string;
  links: { settings: string };
  loading?: boolean;
}) {
  const [items, setItems] = React.useState(initial);
  const [tab, setTab] = React.useState<"all" | "unread">("all");
  const [type, setType] = React.useState<NotificationType | null>(null);
  const unread = items.filter((n) => !n.read).length;
  const rows = items.filter((n) => (tab === "all" || !n.read) && (!type || n.type === type));
  const groups = rows.reduce<{ label: string; items: NotificationItem[] }[]>((acc, n) => {
    const label = dayLabel(n.at, now);
    const last = acc[acc.length - 1];
    if (last && last.label === label) last.items.push(n);
    else acc.push({ label, items: [n] });
    return acc;
  }, []);

  function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 text-fg">
          Notifications{" "}
          {unread > 0 ? <span className="text-fg-muted">({unread} unread)</span> : null}
        </h1>
        <Button
          variant="secondary"
          size="sm"
          disabled={unread === 0}
          onClick={() => {
            setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            toast.success("All notifications marked as read");
          }}
        >
          Mark all as read
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList variant="line">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
          </TabsList>
        </Tabs>
        <div
          role="group"
          aria-label="Filter by type"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          {TYPES.map((t) => {
            const on = type === t.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => setType(on ? null : t.key)}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3 text-caption font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  on
                    ? "border-accent bg-accent-soft text-accent-text"
                    : "border-border bg-surface text-fg-muted hover:text-fg",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={BellOffIcon}
          title={tab === "unread" ? "You're all caught up" : "No notifications yet"}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label} aria-labelledby={`day-${g.label}`} className="space-y-2">
              <h2
                id={`day-${g.label}`}
                className="text-overline font-semibold tracking-wider text-fg-muted uppercase"
              >
                {g.label}
              </h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {g.items.map((n) => {
                  const meta = TYPES.find((t) => t.key === n.type) ?? {
                    key: n.type,
                    label: n.type,
                    Icon: PackageIcon,
                  };
                  return (
                    <li key={n.id} className="flex items-start gap-3 p-4">
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          n.read ? "bg-transparent" : "bg-accent",
                        )}
                      />
                      <meta.Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-fg-subtle" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={n.href}
                          onClick={() => markRead(n.id)}
                          className={cn(
                            "block text-body text-fg hover:underline",
                            !n.read && "font-semibold",
                          )}
                        >
                          {n.title}
                          {!n.read ? <span className="sr-only"> (unread)</span> : null}
                        </Link>
                        <p className="truncate text-body-sm text-fg-muted">{n.body}</p>
                        <p className="text-caption text-fg-subtle" title={formatDateTime(n.at)}>
                          {relativeTime(n.at, now)}
                        </p>
                      </div>
                      {n.actionLabel ? (
                        <Button size="sm" variant="secondary" className="shrink-0" asChild>
                          <Link href={n.href} onClick={() => markRead(n.id)}>
                            {n.actionLabel}
                          </Link>
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <Button variant="ghost" className="w-full">
            Load more
          </Button>
        </div>
      )}
      <p className="text-caption text-fg-subtle">
        Manage email preferences in{" "}
        <Link href={links.settings} className="text-accent-text hover:underline">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
