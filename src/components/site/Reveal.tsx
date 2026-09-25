"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

/**
 * CSS reveal on first intersection (docs/07 §7 "Mobile variant": fade-up once, translateY(16px),
 * transform/opacity only). Server HTML renders visible; the client only hides elements that are
 * still below the fold at hydration, so nothing flashes and no-JS/SEO output is unaffected.
 * Reduced motion collapses the transition through the global override (docs/08 §7.4).
 * GSAP pinning for lg+ arrives in P7 alongside `components/motion/Chapter`.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "li" | "article";
  /** Stagger step multiplier (× `--ck-motion-stagger-md`). */
  delay?: number;
  className?: string;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"static" | "pending" | "in">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let first = true;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setState("in");
          io.disconnect();
        } else if (first) {
          setState("pending");
        }
        first = false;
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        ref.current = el;
      }}
      data-reveal={state}
      style={
        delay
          ? { transitionDelay: `calc(var(--ck-motion-stagger-md) * ${String(delay)})` }
          : undefined
      }
      className={cn(
        "transition-[opacity,transform] duration-(--ck-motion-duration-lg) ease-emphasized will-change-[opacity,transform]",
        state === "pending" && "translate-y-4 opacity-0",
        state === "in" && "translate-y-0 opacity-100",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
