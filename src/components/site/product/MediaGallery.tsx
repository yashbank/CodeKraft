"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/components/ui/_utils";

import { MediaPlaceholder } from "../MediaPlaceholder";
import type { MediaItem } from "../types";

/**
 * Product media gallery — SCR-SITE-04: main 16:10 frame + thumbnail strip (buttons with
 * `aria-pressed`); prev/next buttons and "n of N" status double as the phone carousel controls.
 * Placeholder frames until `product_media` lands (P7 swaps in `next/image` / video facade).
 */
export function MediaGallery({ media, className }: { media: MediaItem[]; className?: string }) {
  const [index, setIndex] = useState(0);
  if (media.length === 0) {
    return <MediaPlaceholder alt="Branded placeholder cover" ratio="16/10" className={className} />;
  }
  const active = media[Math.min(index, media.length - 1)] as MediaItem;
  const go = (delta: number) => setIndex((i) => (i + delta + media.length) % media.length);
  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <MediaPlaceholder
          key={active.id}
          alt={active.alt}
          kind={active.kind}
          tone={index}
          ratio="16/10"
          label={active.caption ?? (active.kind === "video_embed" ? "Play video" : undefined)}
          className="ck-crossfade animate-in fade-in rounded-xl"
        />
        {media.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-3 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-glass text-fg backdrop-blur-glass hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronLeftIcon aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(1)}
              className="absolute top-1/2 right-3 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-glass text-fg backdrop-blur-glass hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronRightIcon aria-hidden className="size-5" />
            </button>
            <p
              aria-live="polite"
              className="absolute right-3 bottom-3 rounded-full bg-glass px-2.5 py-1 text-caption text-fg backdrop-blur-glass tnum"
            >
              {index + 1} of {media.length}
            </p>
          </>
        ) : null}
      </div>
      {media.length > 1 ? (
        <ul
          aria-label="Media thumbnails"
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
        >
          {media.map((m, i) => (
            <li key={m.id} className="shrink-0">
              <button
                type="button"
                aria-pressed={i === index}
                aria-label={m.alt}
                onClick={() => setIndex(i)}
                className={cn(
                  "block w-20 overflow-hidden rounded-md border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-24",
                  i === index ? "border-accent" : "border-transparent hover:border-border-strong",
                )}
              >
                <MediaPlaceholder
                  alt=""
                  kind={m.kind}
                  tone={i}
                  ratio="16/10"
                  className="rounded-none border-0"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
