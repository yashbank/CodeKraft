import { cn } from "@/components/ui/_utils";

/** Pipeline funnel as labelled bars (colour is never the only encoding). */
export function Funnel({
  stages,
  className,
  caption,
}: {
  stages: Array<{ label: string; value: number }>;
  className?: string;
  caption: string;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className={cn("space-y-1.5", className)}>
      <ol aria-label={caption} className="space-y-1.5">
        {stages.map((s, i) => (
          <li
            key={s.label}
            className="grid grid-cols-[88px_1fr_32px] items-center gap-2 text-body-sm"
          >
            <span className="truncate text-fg-muted">{s.label}</span>
            <span className="h-5 rounded-xs bg-elevated">
              <span
                className="block h-full rounded-xs"
                style={{
                  width: `${Math.max(4, (s.value / max) * 100)}%`,
                  backgroundColor: `var(--ck-chart-seq-${Math.min(i + 1, 5)})`,
                }}
                aria-hidden
              />
            </span>
            <span className="text-right font-mono tnum">{s.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
