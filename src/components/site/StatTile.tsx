import { cn } from "@/components/ui/_utils";

/** docs/08 §6.3 "Stat card": overline label + 28 px tabular value. Final value is in the DOM. */
export function StatTile({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface px-5 py-4", className)}>
      <p className="text-overline tracking-wider text-fg-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-h2 text-accent-text tnum">{value}</p>
    </div>
  );
}
