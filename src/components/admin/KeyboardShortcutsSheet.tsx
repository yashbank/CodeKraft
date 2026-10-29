"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ACCOUNT_SHORTCUTS, ADMIN_SHORTCUTS, isShortcutsKey } from "@/lib/keyboard-shortcuts";

/** Opens on "?" and lists the shortcuts that really exist in this area. */
export function KeyboardShortcutsSheet({ area }: Readonly<{ area: "admin" | "account" }>) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isShortcutsKey(e)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const rows = area === "admin" ? ADMIN_SHORTCUTS : ACCOUNT_SHORTCUTS;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>Press ? at any time to open this list.</SheetDescription>
        </SheetHeader>
        <ul className="space-y-3 px-4 pb-6" aria-label="Keyboard shortcuts">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 text-body-sm">
              <span>{r.label}</span>
              <span className="flex shrink-0 gap-1">
                {r.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-caption"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
