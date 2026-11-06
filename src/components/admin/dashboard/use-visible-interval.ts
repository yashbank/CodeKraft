"use client";

import * as React from "react";

/**
 * Run `callback` every `ms` while the tab is visible. A hidden tab stops the timer completely
 * (no background polling); coming back runs the callback straight away when a full period has
 * passed since the last run, then the timer resumes.
 */
export function useVisibleInterval(callback: () => void, ms: number, enabled = true): void {
  const latest = React.useRef(callback);
  React.useEffect(() => {
    latest.current = callback;
  });

  React.useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let lastRun = Date.now();
    const run = () => {
      lastRun = Date.now();
      latest.current();
    };
    const start = () => {
      if (timer === undefined) timer = setInterval(run, ms);
    };
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") return stop();
      if (Date.now() - lastRun >= ms) run();
      start();
    };
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, enabled]);
}
