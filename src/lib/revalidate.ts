/**
 * Safe revalidation helper (docs/06 §1.10, implementation/PHASE-03.md §P3.11).
 * Wraps Next.js `revalidateTag` so it never crashes outside a request context
 * (e.g. background jobs, CLI scripts, or Vitest runs).
 */
import { revalidateTag } from "next/cache";

export const CATALOG_TAGS = {
  catalog: "catalog",
  sitemap: "sitemap",
  content: "content",
  settings: "settings",
  blog: "blog",
  caseStudies: "case-studies",
} as const;

export function productTag(slug: string): string {
  return `product:${slug}`;
}

export function blogTag(slug: string): string {
  return `blog:${slug}`;
}

export function caseStudyTag(slug: string): string {
  return `case-study:${slug}`;
}

/**
 * Revalidates a cache tag safely. No-ops in non-Next environments or background jobs.
 */
export function revalidateTagSafe(tag: string): void {
  try {
    revalidateTag(tag);
  } catch {
    // In background jobs, unit tests, or edge cases outside Next.js request lifecycle,
    // revalidateTag will throw or fail safely; ignore.
  }
}

/**
 * Revalidates multiple cache tags safely.
 */
export function revalidateTagsSafe(tags: readonly string[]): void {
  for (const tag of tags) {
    revalidateTagSafe(tag);
  }
}
