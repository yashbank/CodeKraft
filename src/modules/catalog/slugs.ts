/**
 * Catalog slug utilities and redirect resolution (FR-SEO, MASTER_SPEC §7).
 */
import { SLUG_MAX } from "@/modules/_shared/zod";

/**
 * Normalizes an arbitrary text string into a URL-friendly slug.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

/**
 * Validates that a string matches the canonical slug pattern: lowercase alphanumeric and hyphens.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= SLUG_MAX;
}
