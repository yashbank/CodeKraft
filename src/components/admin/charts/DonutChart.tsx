import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";
import { bgClass, seriesNo, strokeClass } from "./chart-style";

export type DonutVariant = "donut" | "pie" | "thin-ring" | "segmented" | "center-total" | "compact";

/**
 * Donut / pie (P14-09). Segments are circle strokes measured in percent (`pathLength=100`). The
 * legend is real text (label, value, share) so colour is never the only encoding, and the
 * `<svg>` carries the `aria-label` summary.
 */
export function DonutChart({
  data,
  variant = "donut",
  formatValue = (v) => String(v),
  legendLabel = (d) => d.label,
  summary,
  className,
}: {
  data: Array<{ label: string; value: number }>;
  variant?: DonutVariant;
  formatValue?: (v: number) => string;
  legendLabel?: (d: { label: string; value: number }) => ReactNode;
  summary: string;
  className?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const pie = variant === "pie";
  const r = pie ? 8 : 15.9155;
  const sw = pie ? 16 : variant === "thin-ring" ? 2.5 : 6;
  const gap = variant === "segmented" ? 1.2 : 0;
  let acc = 0;
  return (
    <div data-variant={variant} className={cn("flex flex-wrap items-center gap-4", className)}>
      <svg
        viewBox="0 0 42 42"
        role="img"
        aria-label={summary}
        className={cn("shrink-0", variant === "compact" ? "size-24" : "size-32")}
      >
        <circle cx={21} cy={21} r={r} fill="none" strokeWidth={sw} className="stroke-elevated" />
        {data.map((d, i) => {
          const len = total > 0 ? (d.value / total) * 100 : 0;
          const start = acc;
          acc += len;
          const dash = Math.max(0.1, len - gap);
          return len > 0 ? (
            <circle
              key={d.label}
              cx={21}
              cy={21}
              r={r}
              fill="none"
              pathLength={100}
              strokeWidth={sw}
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={25 - start}
              className={strokeClass(seriesNo(i))}
            />
          ) : null;
        })}
        {variant === "center-total" ? (
          <text
            x={21}
            y={23}
            textAnchor="middle"
            className="fill-fg font-mono"
            style={{ fontSize: 6 }}
          >
            {formatValue(total)}
          </text>
        ) : null}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-body-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn("size-2.5 shrink-0 rounded-xs", bgClass(seriesNo(i)))}
            />
            <span className="min-w-0 flex-1">{legendLabel(d)}</span>
            <span className="font-mono tnum">{formatValue(d.value)}</span>
            <span className="w-10 text-right text-caption text-fg-muted tnum">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
