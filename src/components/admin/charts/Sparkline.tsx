import { cn } from "@/components/ui/_utils";

/** Tiny inline line chart (stat widgets, partner cards). Decorative; the value is in the text. */
export function Sparkline({
  points,
  series = 1,
  className,
  label,
}: {
  points: number[];
  series?: number;
  className?: string;
  label: string;
}) {
  const w = 120;
  const h = 32;
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const d = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((p - min) / (max - min || 1)) * (h - 4) - 2).toFixed(1)}`,
    )
    .join(" ");
  const stroke = [
    "stroke-chart-1",
    "stroke-chart-2",
    "stroke-chart-3",
    "stroke-chart-4",
    "stroke-chart-5",
    "stroke-chart-6",
    "stroke-chart-7",
  ][(series - 1) % 7];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-8 w-30", className)}
      role="img"
      aria-label={label}
    >
      <path
        d={d}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className={stroke}
      />
    </svg>
  );
}
