"use client";

import * as React from "react";

const DURATION_MS = 800;

/**
 * Counts 0 -> `target` once, the first time the element scrolls into view. Renders `target`
 * immediately (SSR, reduced motion, no IntersectionObserver), so the final value is never wrong.
 */
export function useCountUp<T extends HTMLElement>(target: number) {
  const ref = React.useRef<T>(null);
  const [value, setValue] = React.useState(target);
  React.useEffect(() => {
    const el = ref.current;
    if (
      !el ||
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      return;
    }
    setValue(0);
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / DURATION_MS);
        setValue(p >= 1 ? target : target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target]);
  return { ref, value };
}

/** Animated formatted number; tabular-nums keeps the width steady while counting. */
export function AnimatedNumber({
  value,
  format = (n) => String(n),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const { ref, value: v } = useCountUp<HTMLSpanElement>(value);
  return (
    <span ref={ref} className="tnum" aria-label={format(value)}>
      {format(Math.round(v))}
    </span>
  );
}
