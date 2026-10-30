"use client";

import * as React from "react";

/** What one poll tells the scheduler: carry on (default), back off (failure) or stop for good (401/403). */
export type PollOutcome = "ok" | "error" | "stop" | undefined;

/** Interval after `failures` consecutive failures: doubles each time, capped at 8x the base. */
export function backoffDelay(baseMs: number, failures: number): number {
  return Math.min(baseMs * 2 ** failures, baseMs * 8);
}

/**
 * One shared poll loop for every live widget (P15-02): sequential (no overlapping requests),
 * paused while the tab is hidden, polled once straight away when the tab becomes visible again,
 * exponential back-off on failures, permanent stop on "stop".
 */
export function usePolling(
  poll: () => Promise<PollOutcome>,
  { intervalMs, enabled = true }: { intervalMs: number; enabled?: boolean },
): void {
  const pollRef = React.useRef(poll);
  pollRef.current = poll;

  React.useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let busy = false;
    let stopped = false;

    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (!stopped && !document.hidden) timer = setTimeout(() => void run(), delay);
    };
    const run = async () => {
      if (stopped || document.hidden || busy) return;
      busy = true;
      let outcome: PollOutcome;
      try {
        outcome = await pollRef.current();
      } catch {
        outcome = "error";
      }
      busy = false;
      if (outcome === "stop") stopped = true;
      failures = outcome === "error" ? failures + 1 : 0;
      schedule(backoffDelay(intervalMs, failures));
    };
    const onVisibility = () => {
      if (document.hidden) return clearTimeout(timer);
      schedule(0);
    };

    schedule(intervalMs);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
