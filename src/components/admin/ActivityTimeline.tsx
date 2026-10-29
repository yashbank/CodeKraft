import { cn } from "@/components/ui/_utils";
import { formatDateTime } from "./format";
import type { TimelineEvent } from "./types";

/** Newest-first event list with a coloured dot per actor kind (order and customer detail). */
export function ActivityTimeline({
  events,
  empty = "No activity yet",
}: Readonly<{ events: TimelineEvent[]; empty?: string }>) {
  if (events.length === 0) return <p className="text-body-sm text-fg-muted">{empty}</p>;
  return (
    <ol data-testid="activity-timeline" className="space-y-3">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="flex gap-3 text-body-sm">
          <span
            aria-hidden
            className={cn(
              "mt-1.5 size-2 shrink-0 rounded-full",
              e.kind === "admin" ? "bg-accent" : e.kind === "customer" ? "bg-info" : "bg-fg-subtle",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block">{e.text}</span>
            <span className="block text-caption text-fg-muted">
              {e.actor} · <time dateTime={e.at}>{formatDateTime(e.at)}</time>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
