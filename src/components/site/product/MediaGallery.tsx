"use client";

import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/components/ui/_utils";

import { MediaPlaceholder } from "../MediaPlaceholder";
import { classifyGalleryMedia } from "@/modules/catalog/media-access";

import type { MediaItem } from "../types";

/**
 * Product media gallery — SCR-SITE-04: main 16:10 frame + thumbnail strip (buttons with
 * `aria-pressed`); prev/next buttons and "n of N" status double as the phone carousel controls.
 * Placeholder frames until `product_media` lands (P7 swaps in `next/image` / video facade).
 */
export function MediaGallery({
  media: allMedia,
  className,
}: {
  media: MediaItem[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  // Images + videos go in the carousel; PDFs get cards; other private attachments are not shown.
  const media = allMedia.filter((m) => {
    const c = classifyGalleryMedia(m);
    return c === "image" || c === "video";
  });
  const pdfs = allMedia.filter((m) => classifyGalleryMedia(m) === "pdf");
  const pdfBlock = pdfs.length > 0 ? <PdfList pdfs={pdfs} /> : null;
  if (media.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        <MediaPlaceholder
          alt="No image yet"
          label="No image yet"
          ratio="16/10"
          className="rounded-xl"
        />
        {pdfBlock}
      </div>
    );
  }
  const active = media[Math.min(index, media.length - 1)] as MediaItem;
  const go = (delta: number) => setIndex((i) => (i + delta + media.length) % media.length);
  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        {classifyGalleryMedia(active) === "video" && active.url ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- product demo clips have no caption track
          <video
            key={active.id}
            src={active.url}
            controls
            preload="metadata"
            aria-label={active.alt}
            className="w-full rounded-xl bg-black"
            style={{ aspectRatio: "16/10" }}
          />
        ) : active.url ? (
          <div
            className="relative overflow-hidden rounded-xl ck-crossfade animate-in fade-in"
            style={{ aspectRatio: "16/10" }}
          >
            <Image
              src={active.url}
              alt={active.alt}
              fill
              className="object-cover"
              sizes="(min-width:1024px) 60vw, 100vw"
            />
          </div>
        ) : (
          <MediaPlaceholder
            key={active.id}
            alt={active.alt}
            kind={active.kind}
            tone={index}
            ratio="16/10"
            label={active.caption ?? (active.kind === "video_embed" ? "Play video" : undefined)}
            className="ck-crossfade animate-in fade-in rounded-xl"
          />
        )}
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
                {classifyGalleryMedia(m) === "video" ? (
                  <MediaPlaceholder
                    alt=""
                    kind="video_embed"
                    tone={i}
                    ratio="16/10"
                    label="Video"
                    className="rounded-none border-0"
                  />
                ) : m.url ? (
                  <div className="relative" style={{ aspectRatio: "16/10" }}>
                    <Image src={m.url} alt="" fill className="object-cover" sizes="96px" />
                  </div>
                ) : (
                  <MediaPlaceholder
                    alt=""
                    kind={m.kind}
                    tone={i}
                    ratio="16/10"
                    className="rounded-none border-0"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {pdfBlock}
    </div>
  );
}

function PdfList({ pdfs }: { pdfs: MediaItem[] }) {
  return (
    <div className="space-y-3" data-testid="product-pdfs">
      {pdfs.map((m) => (
        <div key={m.id} className="rounded-xl border border-border bg-elevated p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-body-sm font-medium text-fg">
              <FileTextIcon aria-hidden className="size-5 shrink-0 text-fg-muted" />
              <span className="truncate">{m.caption ?? m.alt ?? "Presentation"}</span>
            </p>
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-body-sm font-medium text-accent hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              View PDF
            </a>
          </div>
          {pdfs.length <= 2 ? (
            <iframe
              src={m.url}
              title={`${m.caption ?? m.alt ?? "PDF"} preview`}
              loading="lazy"
              className="mt-3 h-[480px] w-full rounded-md border border-border bg-surface"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
