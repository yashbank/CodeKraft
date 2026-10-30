import { cn } from "@/components/ui/_utils";
import { WEEKDAYS, type HeatmapData } from "@/modules/dashboard-widgets/heatmap";

export type HeatmapVariant =
  "squares" | "rounded" | "circles" | "outlined" | "contrast" | "compact";

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/**
 * Weekday x hour grid (P14-12a). Intensity = accent opacity; `variant` only changes cell shape,
 * border and size. Every cell carries its count in `title`, and a visually hidden table repeats
 * the numbers for assistive tech (docs/07 §6).
 */
export function HeatmapChart({
  data,
  variant = "squares",
  caption,
  className,
}: {
  data: HeatmapData;
  variant?: HeatmapVariant;
  caption: string;
  className?: string;
}) {
  let best = { d: 0, h: 0 };
  data.grid.forEach((row, d) =>
    row.forEach((c, h) => {
      if (c > (data.grid[best.d]?.[best.h] ?? 0)) best = { d, h };
    }),
  );
  const summary = `${caption}: ${data.total} orders, busiest ${WEEKDAYS[best.d]} ${hourLabel(best.h)} (${data.grid[best.d]?.[best.h] ?? 0}).`;
  const cell = cn(
    variant === "rounded" && "rounded-sm",
    variant === "circles" && "rounded-full",
    variant === "outlined" && "border border-border",
    variant === "compact" ? "h-3" : "h-5",
  );
  return (
    <figure data-variant={variant} className={cn("w-full", className)}>
      <div
        role="img"
        aria-label={summary}
        className="grid items-center gap-px"
        style={{ gridTemplateColumns: "2rem repeat(24, minmax(0, 1fr))" }}
      >
        {data.grid.map((row, d) => (
          <div key={WEEKDAYS[d]} className="contents">
            <span className="text-caption text-fg-muted">{WEEKDAYS[d]}</span>
            {row.map((c, h) => (
              <span
                key={h}
                data-cell
                data-count={c}
                title={`${WEEKDAYS[d]} ${hourLabel(h)}: ${c} orders`}
                className={cn("block bg-accent", cell)}
                style={{
                  // Zero stays faint so the grid shape is visible; "contrast" boosts low counts.
                  opacity:
                    c === 0
                      ? 0.06
                      : variant === "contrast"
                        ? 0.4 + 0.6 * (c / data.max)
                        : 0.2 + 0.8 * (c / data.max),
                }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} aria-hidden className="text-center text-[10px] text-fg-muted">
            {h % 6 === 0 ? h : ""}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 text-caption text-fg-muted">{summary}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Day</th>
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h}>{hourLabel(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.grid.map((row, d) => (
            <tr key={WEEKDAYS[d]}>
              <th>{WEEKDAYS[d]}</th>
              {row.map((c, h) => (
                <td key={h}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
