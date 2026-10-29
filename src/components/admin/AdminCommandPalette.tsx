"use client";

import Link from "next/link";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { SearchItem } from "./types";

export const PALETTE_GROUPS = [
  "Actions",
  "Go to",
  "Products",
  "Orders",
  "Customers",
  "Leads",
] as const;

/**
 * ⌘K palette. cmdk supplies the combobox/listbox roles, arrow-key + Enter selection; the Radix
 * dialog supplies the focus trap and Esc. Enter navigates through `onNavigate` (a plain
 * `asChild` link would only react to a mouse click).
 */
export function AdminCommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  items,
  remoteItems,
  onNavigate,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (q: string) => void;
  items: SearchItem[];
  remoteItems: SearchItem[];
  onNavigate: (href: string) => void;
}>) {
  const all = [...items, ...remoteItems];
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Search, jump to a screen or run a quick action"
    >
      <CommandInput
        placeholder="Search or jump to…  (try “new product”, an order no, an email)"
        value={query}
        onValueChange={onQueryChange}
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {PALETTE_GROUPS.map((group) => {
          const rows = all.filter((s) => s.group === group);
          if (rows.length === 0) return null;
          return (
            <CommandGroup key={group} heading={group}>
              {rows.map((s) => (
                <CommandItem
                  key={`${group}-${s.href}-${s.label}`}
                  value={`${group} ${s.label} ${s.hint ?? ""}${remoteItems.includes(s) ? ` ${query}` : ""}`}
                  onSelect={() => onNavigate(s.href)}
                >
                  <Link href={s.href} tabIndex={-1} className="flex w-full items-center gap-2">
                    <span>{s.label}</span>
                    {s.hint ? (
                      <span className="ml-auto text-caption text-fg-muted">{s.hint}</span>
                    ) : null}
                  </Link>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
