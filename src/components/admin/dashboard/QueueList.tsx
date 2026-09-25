import Link from "next/link";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/components/ui/_utils";
import type { QueueItem } from "../types";

/** Up to 5 queue rows; each links into the queue it summarises (SCR-ADM-02). */
export function QueueList({ items, empty }: { items: QueueItem[]; empty: string }) {
  if (items.length === 0)
    return <p className="py-6 text-center text-body-sm text-fg-subtle">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {items.slice(0, 5).map((it) => {
        const inner = (
          <span className="flex items-start gap-2 py-2">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                it.tone === "danger"
                  ? "bg-danger"
                  : it.tone === "warning"
                    ? "bg-warning"
                    : it.tone === "success"
                      ? "bg-success"
                      : it.tone === "info"
                        ? "bg-info"
                        : "bg-fg-subtle",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-sm text-fg">{it.label}</span>
              {it.meta ? (
                <span className="block truncate text-caption text-fg-muted">{it.meta}</span>
              ) : null}
              {it.progress !== undefined ? (
                <Progress
                  value={it.progress}
                  aria-label={`${it.label} progress`}
                  className="mt-1.5 h-1"
                />
              ) : null}
            </span>
          </span>
        );
        return (
          <li key={it.label}>
            {it.href ? (
              <Link href={it.href} className="block hover:bg-accent-soft/50">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
