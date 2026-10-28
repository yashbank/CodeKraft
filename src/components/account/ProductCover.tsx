import Image from "next/image";

import { cn } from "@/components/ui/_utils";

/**
 * Product thumbnail for account/checkout surfaces. Shows the product's primary image when it has
 * one (R8-13); otherwise falls back to the product initials on the brand gradient.
 */
export function ProductCover({
  name,
  imageUrl,
  className,
  ratio = "square",
}: {
  name: string;
  /** Primary product image URL (`ProductCard.coverImage.url`); omitted = initials fallback. */
  imageUrl?: string | null;
  className?: string;
  ratio?: "square" | "wide";
}) {
  const box = ratio === "square" ? "size-16" : "aspect-[16/10] w-full";
  if (imageUrl) {
    return (
      <div
        aria-hidden
        data-testid="product-cover-image"
        className={cn(
          "relative shrink-0 overflow-hidden rounded-md border border-border bg-elevated",
          box,
          className,
        )}
      >
        <Image src={imageUrl} alt="" fill sizes="320px" className="object-cover" />
      </div>
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
  return (
    <div
      data-testid="product-cover-fallback"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-[image:var(--ck-gradient-brand)] font-display text-h4 font-semibold text-inverse-fg",
        box,
        className,
      )}
    >
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span aria-hidden>{initials}</span>
        <span className="text-[9px] font-normal leading-none opacity-90">No image yet</span>
      </div>
    </div>
  );
}
