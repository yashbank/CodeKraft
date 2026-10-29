"use client";

import { ArrowDownIcon, ArrowUpIcon, EllipsisIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/_utils";
import { WIDGET_BODY_HEIGHT } from "./WidgetSkeleton";

/**
 * Widget card — docs/08 §6.3: 44px header (title, muted subtitle, refresh, menu), 16px body.
 * `section aria-labelledby`. In edit mode the header shows "move earlier / later" buttons that
 * reorder the admin's saved layout (R8-10); every control here is wired to a real handler.
 */
export function WidgetFrame({
  id,
  title,
  subtitle,
  rangeChip,
  colSpan,
  rowSpan = 1,
  editing = false,
  onRemove,
  onRefresh,
  refreshing = false,
  onMoveUp,
  onMoveDown,
  viewAllHref,
  viewAllLabel,
  styleName,
  children,
}: {
  id: string;
  /** P14-09 visual style, exposed as `data-style` on the card. */
  styleName?: string;
  title: string;
  subtitle?: string;
  rangeChip?: string;
  colSpan: 3 | 4 | 6 | 8 | 12;
  rowSpan?: 1 | 2;
  editing?: boolean;
  onRemove?: () => void;
  onRefresh?: () => void;
  /** True while the refresh is in flight: spinner on the icon, button disabled. */
  refreshing?: boolean;
  /** Undefined → the widget is already first (button disabled). */
  onMoveUp?: () => void;
  /** Undefined → the widget is already last (button disabled). */
  onMoveDown?: () => void;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: ReactNode;
}) {
  const headingId = `widget-${id}-title`;
  return (
    <section
      aria-labelledby={headingId}
      data-widget={id}
      data-style={styleName}
      className={cn(
        "flex min-h-[176px] flex-col rounded-lg border border-border bg-surface shadow-1",
        colSpan === 3 && "lg:col-span-3",
        colSpan === 4 && "lg:col-span-4",
        colSpan === 6 && "lg:col-span-6",
        colSpan === 8 && "lg:col-span-8",
        colSpan === 12 && "lg:col-span-12",
        rowSpan === 2 && "lg:row-span-2",
        editing && "border-dashed border-accent",
      )}
    >
      <header className="flex h-11 items-center gap-2 border-b border-border px-3">
        {editing ? (
          <span className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${title} earlier`}
              disabled={!onMoveUp}
              onClick={onMoveUp}
            >
              <ArrowUpIcon aria-hidden className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${title} later`}
              disabled={!onMoveDown}
              onClick={onMoveDown}
            >
              <ArrowDownIcon aria-hidden className="size-4" />
            </Button>
          </span>
        ) : null}
        <h2 id={headingId} className="min-w-0 truncate text-body-sm font-semibold">
          {title}
        </h2>
        {subtitle ? (
          <span className="min-w-0 truncate text-caption text-fg-muted">{subtitle}</span>
        ) : null}
        {rangeChip ? (
          <span className="shrink-0 rounded-full bg-elevated px-2 text-caption whitespace-nowrap text-fg-muted">
            {rangeChip}
          </span>
        ) : null}
        <span className="ml-auto flex items-center">
          {onRefresh ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Refresh ${title}`}
              aria-busy={refreshing}
              disabled={refreshing}
              onClick={onRefresh}
            >
              <RefreshCwIcon aria-hidden className={cn("size-4", refreshing && "animate-spin")} />
            </Button>
          ) : null}
          {onRemove ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`${title} menu`}>
                  <EllipsisIcon aria-hidden className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onRefresh ? (
                  <DropdownMenuItem disabled={refreshing} onSelect={onRefresh}>
                    Refresh
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </span>
      </header>
      <div className="flex flex-1 flex-col p-4" style={{ minHeight: WIDGET_BODY_HEIGHT + 32 }}>
        {children}
      </div>
      {viewAllHref ? (
        <footer className="border-t border-border px-4 py-2 text-right">
          <Link href={viewAllHref} className="text-body-sm text-accent-text hover:underline">
            {viewAllLabel ?? "View all"}
          </Link>
        </footer>
      ) : null}
    </section>
  );
}
