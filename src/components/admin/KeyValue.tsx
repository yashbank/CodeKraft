import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

/** Definition list for detail cards: caption label over a value, in a responsive grid. */
export function KeyValue({
  items,
  columns = 2,
  className,
}: {
  items: Array<{ label: string; value: ReactNode; mono?: boolean }>;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-caption text-fg-muted">{it.label}</dt>
          <dd className={cn("text-body-sm text-fg break-words", it.mono && "font-mono")}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
