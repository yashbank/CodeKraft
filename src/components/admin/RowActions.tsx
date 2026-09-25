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

/** Trailing ⋯ row menu — docs/07 §4.8. `label` names the row for assistive tech. */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((a, i) => (
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
                disabled={a.disabled}
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
