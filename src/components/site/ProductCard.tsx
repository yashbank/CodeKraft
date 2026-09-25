import { HeartIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/_utils";

import { modelChip } from "./_format";
import { MediaPlaceholder } from "./MediaPlaceholder";
import { PriceBlock } from "./PriceBlock";
import type { ProductSummary } from "./types";

export interface ProductCardProps {
  product: ProductSummary;
  /** `row` = list view on /products (description clamp-2 + tech chips). */
  layout?: "grid" | "row";
  /** Customer-only wishlist heart state; undefined hides the heart (visitor). */
  wishlisted?: boolean;
  /** Entitled customers see an "Owned" tick. */
  owned?: boolean;
  className?: string;
}

/**
 * Product card — docs/08 §6.3. Single link wraps the card; "Coming soon" replaces the price with
 * "Notify me"; never shows partner/ownership (BR-02). The wishlist heart is a real button that
 * P7 wires to `toggleWishlist` (API-CAT-35); here it is presentational with `aria-pressed`.
 */
export function ProductCard({
  product,
  layout = "grid",
  wishlisted,
  owned,
  className,
}: ProductCardProps) {
  const p = product;
  const href = `/products/${p.slug}`;
  const primaryModel = p.purchaseModels[0] ?? "one_time";
  return (
    <Card
      data-interactive="true"
      className={cn(
        "group relative gap-0 overflow-hidden py-0 hover:border-border-strong",
        layout === "row" && "sm:flex-row",
        className,
      )}
    >
      <div className={cn("p-3 pb-0", layout === "row" && "sm:w-64 sm:shrink-0 sm:pb-3")}>
        <MediaPlaceholder alt={p.coverAlt} tone={p.coverTone} ratio="16/10" />
        {p.isComingSoon ? (
          <Badge tone="warning" className="absolute top-5 left-5">
            Coming soon
          </Badge>
        ) : p.isFeatured ? (
          <Badge tone="accent" className="absolute top-5 left-5">
            Featured
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-overline tracking-wider text-fg-muted uppercase">{p.category.name}</p>
          {wishlisted !== undefined ? (
            <button
              type="button"
              aria-pressed={wishlisted}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className="relative z-10 -mt-1.5 -mr-1.5 inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <HeartIcon
                aria-hidden
                className={cn("size-4", wishlisted && "fill-accent text-accent")}
              />
            </button>
          ) : null}
        </div>
        <h3 className="text-h4">
          <Link
            href={href}
            className="rounded-xs after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {p.name}
          </Link>
        </h3>
        <p
          className={cn(
            "text-body-sm text-fg-muted",
            layout === "row" ? "line-clamp-2" : "line-clamp-2",
          )}
        >
          {p.shortDescription}
        </p>
        {layout === "row" && p.techStack.length > 0 ? (
          <ul aria-label="Tech stack" className="flex flex-wrap gap-1.5">
            {p.techStack.slice(0, 4).map((t) => (
              <li key={t}>
                <Badge tone="ghost" size="sm">
                  {t}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          {p.isComingSoon ? (
            <span className="text-body-sm font-medium text-fg-muted">
              Notify me when it launches
            </span>
          ) : (
            <PriceBlock amount={p.fromPrice} compareAt={p.compareAtPrice} prefix="From" size="sm" />
          )}
          <div className="flex items-center gap-1.5">
            {p.isNewVersion ? (
              <Badge tone="info" size="sm">
                New version
              </Badge>
            ) : null}
            {owned ? (
              <Badge tone="success" size="sm">
                Owned
              </Badge>
            ) : null}
            <Badge
              tone={
                primaryModel === "subscription"
                  ? "info"
                  : primaryModel === "custom_quote"
                    ? "neutral"
                    : "accent"
              }
              size="sm"
            >
              {modelChip(primaryModel)}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Same footprint as `ProductCard` for route `loading.tsx` (docs/07 §4.1). */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <Card aria-hidden className={cn("gap-0 overflow-hidden py-0", className)}>
      <div className="p-3 pb-0">
        <Skeleton className="aspect-[16/10] w-full" />
      </div>
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex justify-between pt-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </Card>
  );
}
