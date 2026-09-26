import { toneFromSlug } from "@/lib/media-tone";
import type { ProductSummary } from "@/components/site/types";
import type { ProductCard } from "@/modules/catalog/types";

/** Maps a catalog ProductCard (list/featured query result) onto the site ProductSummary view model. */
export function toProductSummary(card: ProductCard): ProductSummary {
  return {
    id: card.slug,
    slug: card.slug,
    name: card.name,
    shortDescription: card.shortDescription,
    category: card.category
      ? { slug: card.category.slug, name: card.category.name }
      : { slug: "uncategorized", name: "Uncategorized" },
    fromPrice: card.fromPrice ?? undefined,
    compareAtPrice: card.compareAtPrice,
    purchaseModels: card.purchaseModels,
    deliveryTypes: card.deliveryTypes,
    isFeatured: card.isFeatured,
    isComingSoon: card.isComingSoon,
    tags: card.tags.map((t) => t.name),
    techStack: [],
    industries: [],
    audiences: [],
    coverAlt: card.name,
    coverTone: toneFromSlug(card.slug),
    publishedAt: new Date().toISOString(),
    popularity: 0,
  };
}
