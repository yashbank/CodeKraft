import { toneFromSlug } from "@/lib/media-tone";
import type { BlogPost, BlogTeaser } from "@/components/site/types";
import type { BlogCard } from "@/modules/blog/types";

const WORDS_PER_MINUTE = 200;

/** Reading time from plain text or HTML (tags stripped); never below 1 minute. */
export function readingMinutes(htmlOrText: string): number {
  const words = htmlOrText
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** Maps a `BlogCard` (listBlogPosts / listBlogTeasers) onto the site `BlogTeaser` view model. */
export function toBlogTeaser(card: BlogCard): BlogTeaser {
  return {
    slug: card.slug,
    title: card.title,
    excerpt: card.excerpt ?? "",
    publishedAt: card.publishedAt,
    readingMinutes: readingMinutes(`${card.title} ${card.excerpt ?? ""}`),
    coverAlt: card.cover?.alt ?? card.title,
    coverTone: toneFromSlug(card.slug),
    coverUrl: card.cover?.url || undefined,
    product: {
      slug: card.product.slug,
      name: card.product.name,
      category: { slug: "all", name: "Blog" },
    },
  };
}

export function toBlogPost(teaser: BlogTeaser, bodyHtml: string): BlogPost {
  return { ...teaser, readingMinutes: readingMinutes(bodyHtml), bodyHtml };
}
