import { cn } from "@/components/ui/_utils";

export interface BarDatum {
  label: string;
  value: number;
}

const SERIES_FILL = [
  "fill-chart-1",
  "fill-chart-2",
  "fill-chart-3",
  "fill-chart-4",
  "fill-chart-5",
  "fill-chart-6",
  "fill-chart-7",
] as const;

/**
 * SVG bar chart (single series) — stands in for Recharts until Phase 8 (docs/08 §6.17).
 * Colours are the `--ck-chart-*` tokens; every chart carries a visually hidden data table and a
 * text summary (docs/07 §6). `series` picks the token (1-based); `colourByBar` cycles them.
 */
export function BarChart({
  data,
  formatValue = (v) => String(v),
  series = 1,
  colourByBar = false,
  height = 140,
  summary,
  caption,
  className,
}: {
  data: BarDatum[];
  formatValue?: (v: number) => string;
  series?: number;
  colourByBar?: boolean;
  height?: number;
  summary: string;
  caption: string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 320;
  const gap = 8;
  const bw = data.length > 0 ? (w - gap * (data.length + 1)) / data.length : 0;
  const plotH = height;
  const gridLines = [0.25, 0.5, 0.75, 1];
  return (
    <figure className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${w} ${plotH}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
        role="img"
        aria-label={summary}
      >
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
          const fill = SERIES_FILL[(colourByBar ? i : series - 1) % SERIES_FILL.length];
          return (
            <g key={d.label}>
              <rect x={x} y={plotH - h} width={bw} height={h} rx={2} className={fill}>
                <title>{`${d.label}: ${formatValue(d.value)}`}</title>
              </rect>
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
          {data.map((d) => (
            <tr key={d.label}>
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
  height = 160,
  summary,
  caption,
  className,
}: {
  data: Array<{ label: string; a: number; b: number }>;
  formatValue?: (v: number) => string;
  seriesLabels: [string, string];
  height?: number;
  summary: string;
  caption: string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.a + d.b));
  const w = 320;
  const gap = 12;
  const bw = data.length > 0 ? (w - gap * (data.length + 1)) / data.length : 0;
  const plotH = height;
  return (
    <figure className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${w} ${plotH}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
        role="img"
        aria-label={summary}
      >
        {data.map((d, i) => {
          const ha = (d.a / max) * plotH;
          const hb = (d.b / max) * plotH;
          const x = gap + i * (bw + gap);
          return (
            <g key={d.label}>
              <rect x={x} y={plotH - ha} width={bw} height={ha} rx={2} className="fill-chart-3">
                <title>{`${d.label} ${seriesLabels[0]}: ${formatValue(d.a)}`}</title>
              </rect>
              <rect
                x={x}
                y={plotH - ha - hb}
                width={bw}
                height={hb}
                rx={2}
                className="fill-chart-5"
              >
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
          {data.map((d) => (
            <tr key={d.label}>
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
function AxisLabels({ labels }: { labels: string[] }) {
  return (
    <div
      aria-hidden
      className="mt-1 grid text-center text-caption text-fg-muted"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, labels.length)}, minmax(0, 1fr))` }}
    >
      {labels.map((l) => (
        <span key={l} className="truncate px-0.5">
          {l}
        </span>
      ))}
    </div>
  );
}
