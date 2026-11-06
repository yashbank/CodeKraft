"use client";

import Link from "next/link";
import { EllipsisIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  label: string;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

/**
 * The ONE per-row control for every admin list (docs/07 §4.8): a single kebab menu, never a
 * cluster of buttons. `label` names the row for assistive tech. The trigger is a 44px touch
 * target (negative vertical margin keeps table rows from growing). Destructive items are always
 * listed last, after a separator, whatever order the caller passed them in.
 */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  const ordered = [
    ...actions.filter((a) => !a.destructive),
    ...actions
      .filter((a) => a.destructive)
      .map((a, i) => ({ ...a, separatorBefore: i === 0 ? true : a.separatorBefore })),
  ];
  // A separator at the very top of the menu looks broken, so drop it from the first item.
  if (ordered[0]?.separatorBefore) ordered[0] = { ...ordered[0], separatorBefore: false };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          data-row-actions=""
          className="size-11 max-lg:size-11 min-h-11 min-w-11 -my-2"
        >
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ordered.map((a, i) => (
          <div key={`${a.label}-${i}`}>
            {a.separatorBefore ? <DropdownMenuSeparator /> : null}
            {a.href ? (
              <DropdownMenuItem
                asChild
                disabled={a.disabled}
                variant={a.destructive ? "destructive" : "default"}
              >
                <Link href={a.href}>{a.label}</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={a.onSelect}
                // No handler = nothing to run: show it disabled rather than as a dead click.
                disabled={a.disabled || !a.onSelect}
                variant={a.destructive ? "destructive" : "default"}
              >
                {a.label}
              </DropdownMenuItem>
            )}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
