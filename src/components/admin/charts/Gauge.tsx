import { cn } from "@/components/ui/_utils";

/** Usage gauge with text value; `role="meter"` exposes the numbers. */
export function Gauge({
  value,
  max,
  label,
  format = (v) => String(v),
  className,
}: {
  value: number;
  max: number;
  label: string;
  format?: (v: number) => string;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-chart-7";
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-body-sm">
        <span className="text-fg-muted">{label}</span>
        <span className="font-mono tnum">
          {format(value)} / {format(max)}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${format(value)} of ${format(max)} (${pct} %)`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-elevated"
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
