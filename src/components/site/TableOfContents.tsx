"use client";

import { useEffect, useState } from "react";

import { cn } from "@/components/ui/_utils";

export interface TocItem {
  id: string;
  label: string;
}

/**
 * In-page TOC with IntersectionObserver scroll spy (never steals focus). `nav` labelled by the
 * caller ("On this page", "Contents", "Article contents"); current item gets `aria-current`.
 * `variant="chips"` is the phone rendering (horizontal scroller).
 */
export function TableOfContents({
  items,
  label,
  variant = "list",
  className,
}: {
  items: TocItem[];
  label: string;
  variant?: "list" | "chips";
  className?: string;
}) {
  const [current, setCurrent] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setCurrent(visible.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label={label} className={className}>
      <ul
        className={cn(
          variant === "chips"
            ? "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
            : "space-y-1 border-l border-border",
        )}
      >
        {items.map((item) => {
          const isCurrent = current === item.id;
          return (
            <li key={item.id} className={variant === "chips" ? "shrink-0" : undefined}>
              <a
                href={`#${item.id}`}
                aria-current={isCurrent ? "location" : undefined}
                className={cn(
                  "block rounded-sm text-body-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  variant === "chips"
                    ? cn(
                        "h-9 rounded-full border px-3.5 leading-9 whitespace-nowrap",
                        isCurrent
                          ? "border-accent bg-accent-soft text-accent-text"
                          : "border-border bg-surface text-fg-muted hover:text-fg",
                      )
                    : cn(
                        "-ml-px border-l-2 py-1.5 pl-4",
                        isCurrent
                          ? "border-accent font-medium text-fg"
                          : "border-transparent text-fg-muted hover:text-fg",
                      ),
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
