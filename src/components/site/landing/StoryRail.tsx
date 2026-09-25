"use client";

import { useEffect, useState } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/_utils";

export interface StoryChapterRef {
  id: string;
  label: string;
}

/**
 * Story progress rail (docs/08 §6.6): fixed right at lg+, 4 px track with accent fill and one dot
 * per chapter; `nav aria-label="Story chapters"`, `aria-current` on the active dot; native anchor
 * scroll (no scroll-jacking). Below lg it is a thin progress bar under the header.
 */
export function StoryRail({ chapters }: { chapters: StoryChapterRef[] }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const targets = chapters
      .map((c) => document.getElementById(c.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(targets.indexOf(hit.target as HTMLElement));
      },
      { threshold: [0.25, 0.5, 0.75] },
    );
    targets.forEach((t) => io.observe(t));
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [chapters]);

  return (
    <>
      <div
        aria-hidden
        className="sticky top-(--site-header-top,0px) z-(--ck-z-sticky) mt-14 -mb-14 h-0.5 w-full bg-border lg:hidden"
      >
        <div
          className="h-full origin-left bg-accent"
          style={{ transform: `scaleX(${String(progress)})` }}
        />
      </div>
      <TooltipProvider>
        <nav
          aria-label="Story chapters"
          className="fixed top-1/2 right-4 z-(--ck-z-sticky) hidden -translate-y-1/2 lg:block xl:right-6 tv:right-10"
        >
          <ol className="relative flex flex-col items-center gap-5 py-2">
            <span
              aria-hidden
              className="absolute inset-y-2 left-1/2 w-1 -translate-x-1/2 rounded-full bg-border"
            />
            <span
              aria-hidden
              className="absolute top-2 left-1/2 w-1 -translate-x-1/2 origin-top rounded-full bg-accent transition-transform duration-(--ck-motion-duration-sm)"
              style={{
                height: "calc(100% - 1rem)",
                transform: `translateX(-50%) scaleY(${String(progress)})`,
              }}
            />
            {chapters.map((c, i) => {
              const isActive = i === active;
              return (
                <li key={c.id} className="relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={`#${c.id}`}
                        aria-label={c.label}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "block size-3.5 rounded-full border-2 transition-[background-color,border-color,transform] duration-(--ck-motion-duration-sm) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring tv:size-6",
                          isActive
                            ? "scale-125 border-accent bg-accent"
                            : "border-border-strong bg-canvas hover:border-accent",
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="left" sideOffset={10}>
                      {c.label}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
        </nav>
      </TooltipProvider>
    </>
  );
}
