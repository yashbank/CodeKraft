"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { cn } from "@/components/ui/_utils";
import { PaintDefs, markPaint, seriesNo } from "./chart-style";
import { formatBarTooltip } from "./tooltip";

export type BarVariant = "filled" | "outlined" | "minimal" | "gradient" | "compact" | "striped";

export interface BarDatum {
  label: string;
  value: number;
  /** Drill-down target; the bar becomes a keyboard-operable link. */
  href?: string;
}

/**
 * SVG bar chart (single series) — stands in for Recharts until Phase 8 (docs/08 §6.17).
 * Colours are the `--ck-chart-*` tokens; every chart carries a visually hidden data table and a
 * text summary (docs/07 §6). `series` picks the token (1-based); `colourByBar` cycles them.
 * `variant` is the P14-09 visual style (paint/grid/height only; every number stays visible).
 */
export function BarChart({
  data,
  formatValue = (v) => String(v),
  series = 1,
  colourByBar = false,
  variant = "filled",
  height = variant === "compact" ? 96 : 140,
  summary,
  caption,
  className,
}: {
  data: BarDatum[];
  formatValue?: (v: number) => string;
  series?: number;
  colourByBar?: boolean;
  variant?: BarVariant;
  height?: number;
  summary: string;
  caption: string;
  className?: string;
}) {
  const router = useRouter();
  const uid = React.useId().replace(/:/g, "");
  const [active, setActive] = React.useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  const w = 320;
  const gap = 8;
  const bw = data.length > 0 ? (w - gap * (data.length + 1)) / data.length : 0;
  const plotH = height;
  const gridLines = variant === "minimal" ? [] : [0.25, 0.5, 0.75, 1];
  const noOf = (i: number) => seriesNo(colourByBar ? i : series - 1);
  return (
    <figure data-variant={variant} className={cn("relative w-full", className)}>
      {active !== null && data[active] ? (
        <div
          aria-hidden
          data-testid="bar-tooltip"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-elevated px-2 py-1 text-caption whitespace-nowrap text-fg shadow-3 tnum"
          style={{ left: `${((gap + active * (bw + gap) + bw / 2) / w) * 100}%` }}
        >
          {formatBarTooltip(data[active].label, data[active].value, total, formatValue)}
        </div>
      ) : null}
      <div aria-hidden className="text-right text-caption text-fg-muted tnum">
        Max {formatValue(max)}
      </div>
      <svg
        viewBox={`0 0 ${w} ${plotH}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
        role="group"
        aria-label={summary}
      >
        <PaintDefs id={uid} variant={variant} nos={data.map((_, i) => noOf(i))} />
        {gridLines.map((g) => (
          <line
            key={g}
            x1={0}
            x2={w}
            y1={plotH - plotH * g}
            y2={plotH - plotH * g}
            className="stroke-chart-grid"
            strokeWidth={1}
          />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * plotH;
          const x = gap + i * (bw + gap);
          const paint = markPaint(uid, variant, noOf(i));
          return (
            <g
              key={`${d.label}-${i}`}
              tabIndex={0}
              role={d.href ? "link" : "img"}
              aria-label={formatBarTooltip(d.label, d.value, total, formatValue)}
              data-active={active === i || undefined}
              className={cn(
                "outline-none focus-visible:[&>rect:last-child]:stroke-fg",
                d.href && "cursor-pointer",
              )}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={d.href ? () => router.push(d.href as string) : undefined}
              onKeyDown={
                d.href
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(d.href as string);
                      }
                    }
                  : undefined
              }
            >
              {/* full-height hit area so thin bars are easy to hover */}
              <rect x={x} y={0} width={bw} height={plotH} fill="transparent" />
              <rect
                x={x}
                y={plotH - h}
                width={bw}
                height={h}
                rx={2}
                strokeWidth={2}
                {...paint}
                className={cn(
                  paint.className,
                  "transition-opacity",
                  active !== null && active !== i && "opacity-60",
                )}
              />
            </g>
          );
        })}
      </svg>
      <AxisLabels labels={data.map((d) => d.label)} />
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <th scope="row">{d.label}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Two-series stacked bars (expenses vs profit). */
export function StackedBarChart({
  data,
  formatValue = (v) => String(v),
  seriesLabels,
  variant = "filled",
  height = variant === "compact" ? 110 : 160,
  summary,
  caption,
  className,
}: {
  data: Array<{ label: string; a: number; b: number }>;
  formatValue?: (v: number) => string;
  seriesLabels: [string, string];
  variant?: BarVariant;
  height?: number;
  summary: string;
  caption: string;
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, "");
  const pa = markPaint(uid, variant, 3);
  const pb = markPaint(uid, variant, 5);
  const max = Math.max(1, ...data.map((d) => d.a + d.b));
  const w = 320;
  const gap = 12;
  const bw = data.length > 0 ? (w - gap * (data.length + 1)) / data.length : 0;
  const plotH = height;
  return (
    <figure data-variant={variant} className={cn("w-full", className)}>
      <div aria-hidden className="text-right text-caption text-fg-muted tnum">
        Max {formatValue(max)}
      </div>
      <svg
        viewBox={`0 0 ${w} ${plotH}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
        role="img"
        aria-label={summary}
      >
        <PaintDefs id={uid} variant={variant} nos={[3, 5]} />
        {data.map((d, i) => {
          const ha = (d.a / max) * plotH;
          const hb = (d.b / max) * plotH;
          const x = gap + i * (bw + gap);
          return (
            <g key={`${d.label}-${i}`}>
              <rect x={x} y={plotH - ha} width={bw} height={ha} rx={2} {...pa}>
                <title>{`${d.label} ${seriesLabels[0]}: ${formatValue(d.a)}`}</title>
              </rect>
              <rect x={x} y={plotH - ha - hb} width={bw} height={hb} rx={2} {...pb}>
                <title>{`${d.label} ${seriesLabels[1]}: ${formatValue(d.b)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <AxisLabels labels={data.map((d) => d.label)} />
      <div className="mt-1 flex gap-4 text-caption text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-chart-3" /> {seriesLabels[0]}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-chart-5" /> {seriesLabels[1]}
        </span>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">{seriesLabels[0]}</th>
            <th scope="col">{seriesLabels[1]}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <th scope="row">{d.label}</th>
              <td>{formatValue(d.a)}</td>
              <td>{formatValue(d.b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** HTML axis labels under the SVG so text never scales with the widget width. */
export function AxisLabels({ labels }: { labels: string[] }) {
  return (
    <div
      aria-hidden
      className="mt-1 grid text-center text-caption text-fg-muted"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, labels.length)}, minmax(0, 1fr))` }}
    >
      {labels.map((l, i) => (
        <span key={`${l}-${i}`} className="truncate px-0.5">
          {l}
        </span>
      ))}
    </div>
  );
}
