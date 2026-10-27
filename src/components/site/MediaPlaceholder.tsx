import { FileTextIcon, ImageIcon, PlayIcon, PresentationIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/components/ui/_utils";

import type { MediaKind } from "./types";

const TONES = [
  "from-accent/40 via-accent-soft to-secondary-soft",
  "from-secondary/35 via-accent-soft to-elevated",
  "from-info-soft via-accent-soft to-accent/30",
  "from-warning-soft via-elevated to-accent-soft",
  "from-success-soft via-accent-soft to-secondary/30",
  "from-accent/30 via-secondary-soft to-elevated",
] as const;

/**
 * Token-gradient stand-in for product/case-study/blog media until `next/image` + `media` rows
 * land (P7). Keeps the final aspect ratio so layouts don't shift when real images arrive.
 * `alt` is exposed via `role="img"` so screen readers get the same description.
 * Pass `src` (an uploaded image URL) to render the real image in the same frame instead.
 */
export function MediaPlaceholder({
  alt,
  tone = 0,
  kind = "image",
  ratio = "16/10",
  label,
  src,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  className,
}: {
  alt: string;
  /** Real image URL; when set the frame shows it instead of the gradient stand-in. */
  src?: string | null;
  sizes?: string;
  tone?: number;
  kind?: MediaKind;
  /** CSS aspect-ratio value. */
  ratio?: "16/10" | "16/9" | "4/3" | "21/9" | "1/1" | "3/2";
  /** Optional visible caption inside the frame (e.g. "Product tour"). */
  label?: string;
  className?: string;
}) {
  if (src) {
    return (
      <div
        style={{ aspectRatio: ratio }}
        className={cn(
          "relative w-full overflow-hidden rounded-md border border-border bg-elevated",
          className,
        )}
      >
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      </div>
    );
  }
  const Icon =
    kind === "video_embed"
      ? PlayIcon
      : kind === "presentation"
        ? PresentationIcon
        : kind === "gallery"
          ? FileTextIcon
          : ImageIcon;
  return (
    <div
      role="img"
      aria-label={alt}
      style={{ aspectRatio: ratio }}
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-md border border-border bg-gradient-to-br",
        TONES[Math.abs(tone) % TONES.length],
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[image:var(--ck-gradient-fade-canvas)] opacity-60"
      />
      <div aria-hidden className="relative flex flex-col items-center gap-2 text-fg-muted">
        <Icon className="size-8 opacity-70" />
        {label ? <span className="text-caption font-medium">{label}</span> : null}
      </div>
    </div>
  );
}
