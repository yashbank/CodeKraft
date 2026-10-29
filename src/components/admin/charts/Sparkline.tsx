import * as React from "react";

import { cn } from "@/components/ui/_utils";
import { fillClass, seriesNo, strokeClass } from "./chart-style";

export type SparklineVariant = "line" | "area" | "bars" | "dots" | "gradient" | "minimal";

/**
 * Tiny inline chart (stat widgets, partner cards). Decorative; the value is in the text.
 * `variant` is the P14-09 style (line is the original look).
 */
export function Sparkline({
  points,
  series = 1,
  className,
  label,
  variant = "line",
}: {
  points: number[];
  series?: number;
  className?: string;
  label: string;
  variant?: SparklineVariant;
}) {
  const uid = React.useId().replace(/:/g, "");
  const w = 120;
  const h = 32;
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const x = (i: number) => i * step;
  const y = (p: number) => h - ((p - min) / (max - min || 1)) * (h - 4) - 2;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`)
    .join(" ");
  const n = seriesNo(series - 1);
  const area = `${d} L${x(points.length - 1).toFixed(1)},${h} L0,${h} Z`;
  const bw = Math.max(2, (w / Math.max(1, points.length)) * 0.6);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-8 w-30", className)}
      role="img"
      aria-label={label}
      data-variant={variant}
    >
      {variant === "gradient" ? (
        <defs>
          <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: `var(--ck-chart-${n})` }} stopOpacity={0.6} />
            <stop offset="1" style={{ stopColor: `var(--ck-chart-${n})` }} stopOpacity={0.05} />
          </linearGradient>
        </defs>
      ) : null}
      {variant === "area" ? (
        <path d={area} className={fillClass(n)} fillOpacity={0.2} stroke="none" />
      ) : null}
      {variant === "gradient" ? <path d={area} fill={`url(#${uid}-g)`} stroke="none" /> : null}
      {variant === "bars" ? (
        <g className={fillClass(n)}>
          {points.map((p, i) => (
            <rect
              key={i}
              x={Math.min(w - bw, Math.max(0, x(i) - bw / 2))}
              y={y(p)}
              width={bw}
              height={h - y(p)}
              rx={1}
            />
          ))}
        </g>
      ) : (
        <path
          d={d}
          fill="none"
          strokeWidth={variant === "minimal" ? 1.25 : 2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className={strokeClass(n)}
        />
      )}
      {variant === "dots"
        ? points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p)} r={2.2} className={fillClass(n)} />
          ))
        : null}
    </svg>
  );
}
