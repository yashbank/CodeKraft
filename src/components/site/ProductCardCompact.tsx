import { HeartIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/_utils";

import { MediaPlaceholder } from "./MediaPlaceholder";
import { PriceBlock } from "./PriceBlock";
import type { ProductSummary } from "./types";

/** Compact product card for the blog post rail: cover, name, from-price, "View product", heart. */
export function ProductCardCompact({
  product,
  wishlisted,
  className,
}: {
  product: ProductSummary;
  wishlisted?: boolean;
  className?: string;
}) {
  const p = product;
  return (
    <div
      className={cn("space-y-4 rounded-xl border border-border bg-surface p-4 shadow-1", className)}
    >
      <MediaPlaceholder alt={p.coverAlt} tone={p.coverTone} ratio="16/10" />
      <div className="space-y-1">
        <p className="text-overline tracking-wider text-fg-muted uppercase">{p.category.name}</p>
        <p className="text-h4">{p.name}</p>
        {p.isComingSoon ? (
          <p className="text-body-sm text-fg-muted">Coming soon</p>
        ) : (
          <PriceBlock amount={p.fromPrice} compareAt={p.compareAtPrice} prefix="From" size="sm" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button asChild className="flex-1">
          <Link href={`/products/${p.slug}`}>View product</Link>
        </Button>
        {wishlisted !== undefined ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            aria-pressed={wishlisted}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <HeartIcon aria-hidden className={cn(wishlisted && "fill-accent text-accent")} />
          </Button>
        ) : null}
      </div>
      <p className="text-caption text-fg-subtle">Prices exclude taxes where applicable.</p>
    </div>
  );
}
