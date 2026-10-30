import type { CSSProperties } from "react";

import { cn } from "@/components/ui/_utils";
import type { BarVariant } from "./BarChart";

/** Funnel bar paint per style (P14-09); `colour` is a chart token reference. */
function funnelPaint(variant: BarVariant, colour: string): CSSProperties {
  switch (variant) {
    case "outlined":
      return {
        backgroundColor: `color-mix(in srgb, ${colour} 22%, transparent)`,
        boxShadow: "inset 0 0 0 2px var(--ck-chart-1)",
      };
    case "gradient":
      return {
        backgroundImage: `linear-gradient(90deg, ${colour}, color-mix(in srgb, ${colour} 55%, transparent))`,
      };
    case "striped":
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${colour} 0 4px, var(--ck-color-surface) 4px 6px)`,
      };
    default:
      return { backgroundColor: colour };
  }
}

/** Pipeline funnel as labelled bars (colour is never the only encoding). */
export function Funnel({
  stages,
  className,
  caption,
  variant = "filled",
}: {
  stages: Array<{ label: string; value: number }>;
  className?: string;
  caption: string;
  variant?: BarVariant;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  const compact = variant === "compact";
  return (
    <div data-variant={variant} className={cn("space-y-1.5", className)}>
      <ol aria-label={caption} className={compact ? "space-y-0.5" : "space-y-1.5"}>
        {stages.map((s, i) => (
          <li
            key={s.label}
            className="grid grid-cols-[88px_1fr_32px] items-center gap-2 text-body-sm"
          >
            <span className="truncate text-fg-muted">{s.label}</span>
            <span
              className={cn(
                "rounded-xs",
                compact ? "h-3" : "h-5",
                variant !== "minimal" && "bg-elevated",
              )}
            >
              <span
                className="block h-full rounded-xs"
                style={{
                  width: `${Math.max(4, (s.value / max) * 100)}%`,
                  ...funnelPaint(variant, `var(--ck-chart-seq-${Math.min(i + 1, 5)})`),
                }}
                aria-hidden
              />
            </span>
            <span className="text-right font-mono tnum">{s.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
