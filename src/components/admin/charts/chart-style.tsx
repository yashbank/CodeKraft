/**
 * Shared paint for the dashboard chart styles (P14-09). Colours are always the `--ck-chart-*`
 * theme tokens (so light/dark follow the theme); a style only changes how a mark is filled.
 */
const FILL = [
  "fill-chart-1",
  "fill-chart-2",
  "fill-chart-3",
  "fill-chart-4",
  "fill-chart-5",
  "fill-chart-6",
  "fill-chart-7",
] as const;
const STROKE = [
  "stroke-chart-1",
  "stroke-chart-2",
  "stroke-chart-3",
  "stroke-chart-4",
  "stroke-chart-5",
  "stroke-chart-6",
  "stroke-chart-7",
] as const;
const BG = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
] as const;
/** 1-based chart token number for the nth mark / series. */
export const seriesNo = (i: number) => (i % 7) + 1;
export const fillClass = (n: number) => FILL[n - 1] as string;
export const bgClass = (n: number) => BG[n - 1] as string;
export const strokeClass = (n: number) => STROKE[n - 1] as string;
const tok = (n: number) => `var(--ck-chart-${n})`;

/** `<defs>` for the gradient and striped paints of the series numbers in use. */
export function PaintDefs({ id, variant, nos }: { id: string; variant: string; nos: number[] }) {
  if (variant === "gradient")
    return (
      <defs>
        {[...new Set(nos)].map((n) => (
          <linearGradient key={n} id={`${id}-g${n}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: tok(n) }} />
            <stop offset="1" style={{ stopColor: tok(n) }} stopOpacity={0.55} />
          </linearGradient>
        ))}
      </defs>
    );
  if (variant === "striped")
    return (
      <defs>
        {[...new Set(nos)].map((n) => (
          <pattern
            key={n}
            id={`${id}-s${n}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" style={{ fill: tok(n) }} />
            <rect width="2" height="6" style={{ fill: "var(--ck-color-surface)" }} opacity={0.45} />
          </pattern>
        ))}
      </defs>
    );
  return null;
}

/** Fill props for one bar / area of series `n` in the given style. */
export function markPaint(
  id: string,
  variant: string,
  n: number,
): { fill?: string; className?: string; fillOpacity?: number; strokeWidth?: number } {
  if (variant === "gradient") return { fill: `url(#${id}-g${n})` };
  if (variant === "striped") return { fill: `url(#${id}-s${n})` };
  if (variant === "outlined")
    return { className: `${fillClass(n)} ${strokeClass(n)}`, fillOpacity: 0.18, strokeWidth: 2 };
  return { className: fillClass(n) };
}
