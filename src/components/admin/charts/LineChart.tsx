import * as React from "react";

import { cn } from "@/components/ui/_utils";
import { AxisLabels } from "./BarChart";
import { PaintDefs, markPaint, seriesNo, strokeClass } from "./chart-style";

export type LineVariant = "area" | "line" | "minimal" | "gradient" | "compact" | "dots";

/**
 * SVG line / area chart (single series, P14-09). Same a11y contract as `BarChart`: an `aria-label`
 * summary, a visually hidden data table, visible Max label and axis labels. Points carry a
 * `<title>` for hover. Colour is the `--ck-chart-*` token of `series`.
 */
export function LineChart({
  data,
  formatValue = (v) => String(v),
  series = 1,
  variant = "area",
  height = variant === "compact" ? 96 : 140,
  summary,
  caption,
  className,
}: {
  data: Array<{ label: string; value: number }>;
  formatValue?: (v: number) => string;
  series?: number;
  variant?: LineVariant;
  height?: number;
  summary: string;
  caption: string;
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, "");
  const n = seriesNo(series - 1);
  const w = 320;
  const pad = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const px = (i: number) =>
    data.length > 1 ? pad + (i * (w - 2 * pad)) / (data.length - 1) : w / 2;
  const py = (v: number) => height - (v / max) * (height - 8) - 4;
  const line = data.map((d, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`);
  const areaPath = `${line.join(" ")} L${px(data.length - 1).toFixed(1)},${height} L${px(0).toFixed(1)},${height} Z`;
  const gradient = variant === "gradient";
  const filled = variant === "area" || variant === "compact" || gradient;
  const paint = markPaint(uid, gradient ? "gradient" : "filled", n);
  return (
    <figure data-variant={variant} className={cn("w-full", className)}>
      <div aria-hidden className="text-right text-caption text-fg-muted tnum">
        Max {formatValue(max)}
      </div>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
        role="img"
        aria-label={summary}
      >
        <PaintDefs id={uid} variant={gradient ? "gradient" : ""} nos={[n]} />
        {variant === "minimal"
          ? null
          : [0.25, 0.5, 0.75, 1].map((g) => (
              <line
                key={g}
                x1={0}
                x2={w}
                y1={height - height * g}
                y2={height - height * g}
                className="stroke-chart-grid"
                strokeWidth={1}
              />
            ))}
        {filled ? <path d={areaPath} {...paint} fillOpacity={gradient ? undefined : 0.18} /> : null}
        <path
          d={line.join(" ")}
          fill="none"
          strokeWidth={variant === "minimal" ? 1.5 : 2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className={strokeClass(n)}
        />
        {data.map((d, i) => (
          <line
            key={`${d.label}-${i}`}
            x1={px(i)}
            x2={px(i)}
            y1={py(d.value)}
            y2={py(d.value)}
            strokeLinecap="round"
            strokeWidth={variant === "dots" ? 8 : 14}
            vectorEffect="non-scaling-stroke"
            className={variant === "dots" ? strokeClass(n) : "stroke-transparent"}
          >
            <title>{`${d.label}: ${formatValue(d.value)}`}</title>
          </line>
        ))}
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
