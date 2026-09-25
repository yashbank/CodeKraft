"use client";

import Link from "next/link";
import * as React from "react";
import {
  BellOffIcon,
  BotIcon,
  ClipboardCheckIcon,
  CoinsIcon,
  MessageSquareIcon,
  SettingsIcon,
  TargetIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/components/ui/_utils";
import { EmptyState } from "../EmptyState";
import { FilterChips } from "../FilterChips";
import { formatDate, hoursSince, timeAgo } from "../format";
import type { AdminNotification, NotificationType } from "../types";

const TYPE: Record<NotificationType, { label: string; Icon: LucideIcon }> = {
  payments: { label: "Payments", Icon: CoinsIcon },
  leads: { label: "Leads", Icon: TargetIcon },
  queries: { label: "Queries", Icon: MessageSquareIcon },
  approvals: { label: "Approvals", Icon: ClipboardCheckIcon },
  delivery: { label: "Delivery", Icon: TruckIcon },
  chatbot: { label: "Chatbot", Icon: BotIcon },
  system: { label: "System", Icon: SettingsIcon },
};

/**
 * SCR-ADM-33 — persisted admin notification inbox: All/Unread tabs, type chips, day-grouped rows
 * with inline actions, bulk mark-read, "Load more". Read-mostly on phones: only "Review approval"
 * and "Confirm payment" stay inline; other actions become links with the laptop hint.
 */
export function NotificationsInbox({
  notifications,
  now,
}: {
  notifications: AdminNotification[];
  now: string;
}) {
  const [tab, setTab] = React.useState<"all" | "unread">("all");
  const [type, setType] = React.useState<NotificationType | null>(null);
  const [readIds, setReadIds] = React.useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const isRead = (n: AdminNotification) => n.read || readIds.has(n.id);
  const unread = notifications.filter((n) => !isRead(n)).length;
  const list = notifications
    .filter((n) => (tab === "unread" ? !isRead(n) : true))
    .filter((n) => (type ? n.type === type : true));
  const groups = list.reduce((m, n) => {
    const d = formatDate(n.at);
    m.set(d, [...(m.get(d) ?? []), n]);
    return m;
  }, new Map<string, AdminNotification[]>());
  const markRead = (ids: Iterable<string>) => setReadIds((s) => new Set([...s, ...ids]));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-h2">Notifications</h1>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-caption text-accent-text">
          {unread} unread
        </span>
        <Button
          variant="link"
          size="sm"
          className="ml-auto"
          disabled={unread === 0}
          onClick={() => {
            markRead(notifications.map((n) => n.id));
            toast.success("All notifications marked read");
          }}
        >
          Mark all as read
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unread})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="max-w-full overflow-x-auto">
          <FilterChips
            label="Type"
            chips={(Object.keys(TYPE) as NotificationType[]).map((t) => ({
              value: t,
              label: TYPE[t].label,
              count: notifications.filter((n) => n.type === t).length,
            }))}
            value={type}
            onChange={setType}
          />
        </div>
      </div>
      {selected.size > 0 ? (
        <div
          role="status"
          className="mb-3 flex items-center gap-3 rounded-md border border-accent bg-accent-soft px-3 py-2 text-body-sm"
        >
          <span className="font-medium text-accent-text">{selected.size} selected</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              markRead(selected);
              setSelected(new Set());
            }}
          >
            Mark read
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}
      {list.length === 0 ? (
        <EmptyState icon={BellOffIcon} title="You're all caught up" />
      ) : (
        <div className="mx-auto max-w-[960px] space-y-6">
          {[...groups.entries()].map(([day, items]) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2
                id={`day-${day}`}
                className="mb-2 text-overline tracking-wider text-fg-muted uppercase"
              >
                {day}
              </h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {items.map((n) => {
                  const { Icon } = TYPE[n.type];
                  const read = isRead(n);
                  const old = hoursSince(n.at, now) > 48 && !read;
                  const readMostlyAction = n.action?.readMostly;
                  return (
                    <li key={n.id} className="flex items-start gap-3 px-3 py-3 tv:py-4">
                      <Checkbox
                        aria-label={`Select ${n.title}`}
                        className="mt-1"
                        checked={selected.has(n.id)}
                        onCheckedChange={(v) =>
                          setSelected((s) => {
                            const x = new Set(s);
                            if (v === true) x.add(n.id);
                            else x.delete(n.id);
                            return x;
                          })
                        }
                      />
                      <span className="relative mt-1 shrink-0">
                        <Icon aria-hidden className="size-5 text-fg-muted" />
                        {!read ? (
                          <span
                            aria-hidden
                            className="absolute -top-1 -right-1 size-2 rounded-full bg-accent"
                          />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={n.href ?? "#"}
                          onClick={() => markRead([n.id])}
                          className={cn(
                            "block text-body-sm hover:text-accent-text",
                            !read && "font-semibold",
                          )}
                        >
                          {!read ? <span className="sr-only">Unread: </span> : null}
                          {n.title}
                        </Link>
                        <p className="truncate text-caption text-fg-muted">{n.body}</p>
                        {n.action ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button
                              asChild
                              size="sm"
                              variant="secondary"
                              className={cn(!readMostlyAction && "hidden lg:inline-flex")}
                            >
                              <Link href={n.action.href}>{n.action.label}</Link>
                            </Button>
                            {!readMostlyAction ? (
                              <Link
                                href={n.action.href}
                                className="text-caption text-accent-text hover:underline lg:hidden"
                              >
                                {n.action.label} · open on a laptop
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <time
                        dateTime={n.at}
                        title={n.at}
                        className={cn(
                          "shrink-0 text-caption",
                          old ? "text-warning" : "text-fg-subtle",
                        )}
                      >
                        {timeAgo(n.at, now)}
                        {old ? " · unread" : ""}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => toast("No more notifications")}>
              Load more
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
