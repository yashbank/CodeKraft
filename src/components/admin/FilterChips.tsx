"use client";

import { cn } from "@/components/ui/_utils";

export interface FilterChip<T extends string> {
  value: T;
  label: string;
  count?: number;
  tone?: "warning" | "danger" | "success" | "info";
}

/** Status / queue chips as toggle buttons with `aria-pressed` (docs/07 §4.8; SCR-ADM-03/06). */
export function FilterChips<T extends string>({
  chips,
  value,
  onChange,
  label,
  allowNone = true,
}: {
  chips: Array<FilterChip<T>>;
  value: T | null;
  onChange: (next: T | null) => void;
  label: string;
  allowNone?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const pressed = value === chip.value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(pressed && allowNone ? null : chip.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              pressed
                ? "border-accent bg-accent-soft text-accent-text"
                : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
              chip.tone === "warning" && !pressed && "border-warning/40",
              chip.tone === "danger" && !pressed && "border-danger/40",
            )}
          >
            {chip.label}
            {chip.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 font-mono text-caption tnum",
                  pressed ? "bg-accent text-accent-fg" : "bg-elevated text-fg-muted",
                )}
              >
                {chip.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
