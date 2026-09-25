"use client";

import { BellIcon, BellOffIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/_utils";
import { relativeTime } from "./format";
import type { NotificationItem } from "./types";

/**
 * Notification bell (docs/08 §6.14): unread `danger` pill (99+), popover with the 8 most recent,
 * "Mark all read" and "View all". Polling (30 s) is wired in Phase 7.
 */
export function NotificationBell({
  items,
  unreadCount,
  now,
  viewAllHref,
  onMarkAllRead,
}: {
  items: NotificationItem[];
  unreadCount: number;
  now: string;
  viewAllHref: string;
  onMarkAllRead?: () => void;
}) {
  const recent = items.slice(0, 8);
  const count = unreadCount > 99 ? "99+" : String(unreadCount);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-md"
          className="relative"
          aria-label={`Notifications, ${unreadCount} unread`}
        >
          <BellIcon aria-hidden />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] font-semibold text-danger-fg"
            >
              {count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(400px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-body-sm font-semibold text-fg">Notifications</p>
          <button
            type="button"
            className="text-caption text-accent-text hover:underline disabled:text-fg-subtle disabled:no-underline"
            disabled={unreadCount === 0}
            onClick={onMarkAllRead}
          >
            Mark all read
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-body-sm text-fg-muted">
            <BellOffIcon aria-hidden className="size-6 text-fg-subtle" />
            You&apos;re up to date
          </div>
        ) : (
          <ul className="max-h-[420px] overflow-auto py-1">
            {recent.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className="flex gap-3 px-4 py-3 hover:bg-accent-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-2 size-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-accent",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-body-sm",
                        n.read ? "text-fg" : "font-semibold text-fg",
                      )}
                    >
                      {n.title}
                      {!n.read ? <span className="sr-only"> (unread)</span> : null}
                    </span>
                    <span className="block truncate text-body-sm text-fg-muted">{n.body}</span>
                    <span className="block text-caption text-fg-subtle">
                      {relativeTime(n.at, now)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border px-4 py-2 text-right">
          <Link href={viewAllHref} className="text-body-sm text-accent-text hover:underline">
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
