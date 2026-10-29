import { cn } from "@/components/ui/_utils";

export type GaugeVariant = "solid" | "thin" | "thick" | "segmented" | "striped" | "outlined";

/** Usage gauge with text value; `role="meter"` exposes the numbers. `variant` is the P14-09 style. */
export function Gauge({
  value,
  max,
  label,
  format = (v) => String(v),
  variant = "solid",
  className,
}: {
  value: number;
  max: number;
  label: string;
  format?: (v: number) => string;
  variant?: GaugeVariant;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-chart-7";
  const lit = Math.round(pct / 10);
  const segmented = variant === "segmented";
  return (
    <div data-variant={variant} className={cn("space-y-1", className)}>
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
        className={cn(
          "w-full",
          segmented ? "grid grid-cols-10 gap-0.5" : "overflow-hidden rounded-full",
          variant === "thin" ? "h-1.5" : variant === "thick" ? "h-4" : "h-2.5",
          variant === "outlined" && "border border-fg-muted p-px",
          !segmented && variant !== "outlined" && "bg-elevated",
        )}
      >
        {segmented ? (
          Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={cn("rounded-xs", i < lit ? tone : "bg-elevated")} />
          ))
        ) : (
          <div
            className={cn("h-full rounded-full", tone)}
            style={{
              width: `${pct}%`,
              ...(variant === "striped"
                ? {
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent 0 4px, var(--ck-color-surface) 4px 6px)",
                  }
                : null),
            }}
          />
        )}
      </div>
    </div>
  );
}
