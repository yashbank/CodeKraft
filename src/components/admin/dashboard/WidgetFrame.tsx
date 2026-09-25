"use client";

import { EllipsisIcon, GripVerticalIcon, RefreshCwIcon } from "lucide-react";
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

/**
 * Widget card — docs/08 §6.3: 44px header (title, muted subtitle, refresh, drag handle, menu),
 * 16px body. `section aria-labelledby`. The grip is a button with keyboard instructions
 * (react-grid-layout wires the actual dragging in Phase 8).
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
  viewAllHref,
  viewAllLabel,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  rangeChip?: string;
  colSpan: 3 | 4 | 6 | 8 | 12;
  rowSpan?: 1 | 2;
  editing?: boolean;
  onRemove?: () => void;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: ReactNode;
}) {
  const headingId = `widget-${id}-title`;
  const hintId = `widget-${id}-drag-hint`;
  return (
    <section
      aria-labelledby={headingId}
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
          <>
            <button
              type="button"
              aria-label={`Move ${title}`}
              aria-describedby={hintId}
              className="cursor-grab rounded-sm text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <GripVerticalIcon aria-hidden className="size-4" />
            </button>
            <span id={hintId} className="sr-only">
              Arrow keys move by one column or row; Shift plus arrows resize; Enter confirms.
            </span>
          </>
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
          <Button variant="ghost" size="icon-sm" aria-label={`Refresh ${title}`}>
            <RefreshCwIcon aria-hidden className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`${title} menu`}>
                <EllipsisIcon aria-hidden className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Refresh</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </header>
      <div className="flex flex-1 flex-col p-4">{children}</div>
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
