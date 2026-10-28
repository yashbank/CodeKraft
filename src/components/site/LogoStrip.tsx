"use client";

import * as React from "react";

import { cn } from "@/components/ui/_utils";

import { LogoMark } from "./LogoMark";
import type { ClientLogo } from "./types";

const MAX_SCALE = 1.6;
const RADIUS = 140;

/** Dock-style magnification: 1 at/after `radius` px from the pointer, `max` right under it, eased between. */
export function magnifyScale(distance: number, max = MAX_SCALE, radius = RADIUS): number {
  const d = Math.abs(distance);
  if (d >= radius) return 1;
  return 1 + (max - 1) * ((1 + Math.cos((Math.PI * d) / radius)) / 2);
}

/** Magnify only where a real hover pointer exists; touch/coarse devices never magnify. */
function useFinePointer(): boolean {
  const [fine, setFine] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return fine;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () =>
      setReduced(mq.matches || document.documentElement.dataset.motion === "reduce");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * Client logo strip (docs/08 §6.5 trust row): greyscale `fg-subtle` at 70 %, colour on hover.
 * Renders the uploaded logo image (Admin → Content → Testimonials & logos) when there is one,
 * otherwise the client name as text. Scrolls as a marquee (paused on hover/focus) with a
 * macOS-Dock magnify under the pointer; both are off under reduced motion.
 */
export function LogoStrip({
  logos,
  label = "Clients",
  className,
}: {
  logos: ClientLogo[];
  label?: string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const finePointer = useFinePointer();
  const trackRef = React.useRef<HTMLDivElement>(null);
  if (logos.length === 0) return null;

  const items = (copy: number) =>
    logos.map((l) => {
      const mark = l.logoUrl ? <LogoMark src={l.logoUrl} name={l.name} /> : l.name;
      return (
        <li
          key={`${copy}-${l.id}`}
          data-logo
          className="group flex h-8 shrink-0 origin-center items-center whitespace-nowrap font-display text-body-lg font-semibold tracking-tight text-fg-subtle opacity-70 transition-[color,opacity,transform] duration-(--ck-motion-duration-sm) hover:text-fg hover:opacity-100"
        >
          {l.href ? (
            <a href={l.href} target="_blank" rel="noopener noreferrer" tabIndex={copy ? -1 : 0}>
              {mark}
            </a>
          ) : (
            mark
          )}
        </li>
      );
    });

  if (reduced) {
    return (
      <ul
        aria-label={label}
        className={cn(
          "flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:justify-between",
          className,
        )}
      >
        {items(0)}
      </ul>
    );
  }

  function magnify(e: React.PointerEvent) {
    trackRef.current?.querySelectorAll<HTMLElement>("[data-logo]").forEach((el) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `scale(${magnifyScale(e.clientX - (r.left + r.width / 2))})`;
    });
  }
  function reset() {
    trackRef.current?.querySelectorAll<HTMLElement>("[data-logo]").forEach((el) => {
      el.style.transform = "";
    });
  }

  return (
    <div
      className={cn("w-full max-w-full overflow-hidden py-6", className)}
      onPointerMove={finePointer ? magnify : undefined}
      onPointerLeave={finePointer ? reset : undefined}
    >
      <div
        ref={trackRef}
        className="flex w-max will-change-transform animate-[ck-marquee_40s_linear_infinite] hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
      >
        <ul
          aria-label={label}
          className="flex shrink-0 items-center gap-x-8 pr-8 md:gap-x-12 md:pr-12"
        >
          {items(0)}
        </ul>
        {/* Second copy makes the -50% loop seamless; hidden from AT and the tab order. */}
        <ul aria-hidden className="flex shrink-0 items-center gap-x-8 pr-8 md:gap-x-12 md:pr-12">
          {items(1)}
        </ul>
      </div>
    </div>
  );
}
