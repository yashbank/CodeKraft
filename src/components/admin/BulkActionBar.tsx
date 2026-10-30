"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/** "N selected" bar shown above a table while rows are ticked; `children` are the actions. */
export function BulkActionBar({
  count,
  onClear,
  children,
}: Readonly<{ count: number; onClear: () => void; children: ReactNode }>) {
  if (count === 0) return null;
  return (
    <div
      role="status"
      data-testid="bulk-bar"
      className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-accent bg-accent-soft px-3 py-2 text-body-sm"
    >
      <span className="font-medium text-accent-text">{count} selected</span>
      {children}
      <Button size="sm" variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
