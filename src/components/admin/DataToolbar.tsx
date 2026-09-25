import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/_utils";

/** Table toolbar — docs/07 §4.8: search input, faceted filters, right-aligned actions. */
export function DataToolbar({
  searchId,
  searchPlaceholder = "Search…",
  searchLabel = "Search",
  filters,
  actions,
  className,
}: {
  searchId: string;
  searchPlaceholder?: string;
  searchLabel?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end gap-3", className)}>
      <div className="relative w-full max-w-xs">
        <Label htmlFor={searchId} className="sr-only">
          {searchLabel}
        </Label>
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
        />
        <Input id={searchId} type="search" placeholder={searchPlaceholder} className="pl-9" />
      </div>
      {filters ? <div className="flex flex-wrap items-end gap-2">{filters}</div> : null}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Labelled control wrapper for toolbar selects. */
export function ToolbarField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-caption text-fg-muted">
        {label}
      </Label>
      {children}
    </div>
  );
}
