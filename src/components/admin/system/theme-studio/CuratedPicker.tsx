"use client";

import { CheckIcon } from "lucide-react";

import { cn } from "@/components/ui/_utils";
import type { ThemeName } from "@/lib/theme";
import { nearestCurated, type CuratedKey, type StudioGroup } from "@/lib/theme-studio";
import { OptionPreview } from "./OptionPreview";

/**
 * Small visual picker for the curated groups (palette, corner radius, borders, button style):
 * a handful of swatch tiles instead of a 40-row dropdown. A stored value from the old long lists
 * shows its nearest tile as selected; nothing is rewritten until the admin picks a tile.
 */
export function CuratedPicker({
  group,
  value,
  theme,
  disabled,
  onChange,
}: {
  group: StudioGroup & { key: CuratedKey };
  value: string;
  theme: ThemeName;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const shown = nearestCurated(group.key, value);
  return (
    <div className="grid gap-1">
      <span id={`curated-${group.key}`} className="text-body-sm font-medium">
        {group.label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`curated-${group.key}`}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {group.ids.map((id) => {
          const on = id === shown;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={group.labelOf(id)}
              disabled={disabled}
              data-option={id}
              onClick={() => onChange(id)}
              className={cn(
                "border-border bg-surface hover:bg-accent-soft/50 flex min-h-14 items-center gap-2 rounded-md border px-2 py-2 text-left text-body-sm transition-colors",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50",
                on && "border-accent bg-accent-soft/60 ring-1 ring-accent",
              )}
            >
              <span className="grid min-w-10 shrink-0 place-items-center">
                <OptionPreview group={group.key} id={id} theme={theme} />
              </span>
              <span className="min-w-0 flex-1 truncate">{group.labelOf(id)}</span>
              {on ? <CheckIcon aria-hidden className="size-4 shrink-0 text-accent-text" /> : null}
            </button>
          );
        })}
      </div>
      <p className="text-caption text-fg-muted">{group.note}</p>
    </div>
  );
}
