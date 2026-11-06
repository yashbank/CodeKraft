"use client";

import * as React from "react";

import { cn } from "@/components/ui/_utils";

/** "just now" under a minute, then whole minutes, hours and days. Pure, for tests. */
export function updatedAgo(at: number, now: number): string {
  const mins = Math.max(0, Math.floor((now - at) / 60_000));
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Updated ${hours} h ago`;
  return `Updated ${Math.floor(hours / 24)} d ago`;
}

/**
 * The small "Updated N min ago" caption of a widget. The clock is read after mount (and re-read
 * every 15 s) so the server render and the first client render agree.
 */
export function UpdatedStamp({ at, className }: { at: number; className?: string }) {
  const [now, setNow] = React.useState(at);
  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [at]);
  return (
    <time
      data-updated-stamp
      dateTime={new Date(at).toISOString()}
      className={cn("block text-caption text-fg-subtle", className)}
    >
      {updatedAgo(at, now)}
    </time>
  );
}
