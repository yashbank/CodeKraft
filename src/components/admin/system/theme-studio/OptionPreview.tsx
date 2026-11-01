import type * as React from "react";

import { Button } from "@/components/ui/button";
import type { ThemeName } from "@/lib/theme";
import { DEFAULT_STUDIO, previewVars, studioAttrs, type StudioValues } from "@/lib/theme-studio";
import { LAYOUT_WIDTH, type LayoutId } from "@/lib/ui-style";
import { toStyle } from "./ThemePreview";

/**
 * Tiny decorative sample of one studio option (shown next to its name, so aria-hidden). The option
 * is applied on top of the defaults as scoped CSS variables, so it renders with its own values.
 */
export function OptionPreview({
  group,
  id,
  theme,
}: {
  group: keyof StudioValues;
  id: string;
  theme: ThemeName;
}) {
  const values = { ...DEFAULT_STUDIO, [group]: id } as StudioValues;
  const box = "border-border bg-surface block size-6 shrink-0 border";
  let body: React.ReactNode;
  switch (group) {
    case "palette":
      body = (
        <span className="flex gap-0.5">
          {["--ck-color-accent", "--ck-color-accent-hover", "--ck-color-accent-soft"].map((c) => (
            <span key={c} className="size-3 rounded-full" style={{ background: `var(${c})` }} />
          ))}
        </span>
      );
      break;
    case "font":
    case "headingFont":
    case "bodyFont":
      body = (
        <span
          className="text-body font-semibold leading-none"
          style={{
            fontFamily: group === "bodyFont" ? "var(--ck-font-body)" : "var(--ck-font-display)",
          }}
        >
          Aa
        </span>
      );
      break;
    case "radius":
      body = <span className={`${box} rounded-lg`} />;
      break;
    case "border":
      body = <span className={`${box} rounded-sm border-2`} />;
      break;
    case "pattern":
      body = <span className="bg-canvas border-border block size-6 rounded-sm border" />;
      break;
    case "button":
      body = (
        <Button type="button" size="sm" tabIndex={-1} className="pointer-events-none h-5 px-2">
          Go
        </Button>
      );
      break;
    case "layout":
      body = (
        <span className="border-border bg-surface flex h-5 w-8 justify-center rounded-sm border">
          <span
            className="bg-accent-solid h-full"
            style={{ width: `${Math.round((LAYOUT_WIDTH[id as LayoutId] / 1680) * 100)}%` }}
          />
        </span>
      );
      break;
    default: // card, density, shadow
      body = (
        <span
          className="border-border bg-surface block h-6 w-8 rounded-md border"
          style={{
            boxShadow: group === "shadow" ? "var(--ck-shadow-md)" : undefined,
            padding: group === "density" ? "var(--card-pad)" : undefined,
          }}
        >
          <span className="bg-fg-muted block h-full w-full rounded-sm opacity-30" />
        </span>
      );
  }
  return (
    <span
      aria-hidden
      data-option-preview={group}
      data-theme={theme}
      {...studioAttrs(values)}
      style={toStyle(previewVars(values, theme))}
      className="inline-flex min-w-8 shrink-0 items-center justify-center"
    >
      {body}
    </span>
  );
}
