/**
 * Blog domain types — docs/05 T-product_blogs (one post per product, D-121, D-804),
 * docs/06 API-CAT-10/33/34.
 */
import type { blogStatus } from "../../../drizzle/schema/catalog";
import type { ImageRef, ProductCard } from "../catalog/types";
import { enumTuple } from "../catalog/types";

export type { ProductBlog } from "../../../drizzle/schema/catalog";

export type BlogStatus = (typeof blogStatus.enumValues)[number];
export const BLOG_STATUSES = enumTuple<BlogStatus>()(["draft", "published"] as const);

/** API-CAT-33 list item / API-CAT-34 teaser. */
export interface BlogCard {
  slug: string;
  title: string;
  excerpt: string | null;
  cover: ImageRef | null;
  publishedAt: string;
  product: { slug: string; name: string };
  author: { name: string };
}

/** Teaser on a product page (API-CAT-31 `blog teaser`). */
export type BlogTeaser = Pick<BlogCard, "slug" | "title" | "excerpt" | "cover" | "publishedAt">;

/** API-CAT-33 `getBlogBySlug`. */
export interface BlogDetail {
  blog: {
    slug: string;
    title: string;
    excerpt: string | null;
    cover: ImageRef | null;
    publishedAt: string;
    seoTitle: string | null;
    seoDescription: string | null;
    author: { name: string };
  };
  product: ProductCard;
  /** Sanitised HTML rendered server-side from `body_json` (ADR-10). */
  html: string;
  jsonLd: Record<string, unknown>;
}
