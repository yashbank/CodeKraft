/**
 * Slug redirects resolution service (FR-SEO, MASTER_SPEC §7).
 * When slugs change on products, blog posts, or case studies, old slugs are recorded in `slug_redirects`.
 */
import { eq, and } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { slugRedirects } from "../../../drizzle/schema/catalog";
import type { SlugRedirectEntity } from "./types";

/**
 * Resolves an old slug to its latest destination slug for an entity.
 * Follows redirects recursively up to 5 hops to prevent infinite redirect loops.
 * Returns null if no redirect exists.
 */
export async function resolveRedirect(
  entity: SlugRedirectEntity,
  oldSlug: string,
  tx?: DbOrTx,
): Promise<string | null> {
  let currentSlug = oldSlug;
  const visited = new Set<string>([oldSlug]);
  const maxHops = 5;

  const dbClient = tx ?? (await import("@/lib/db")).db;

  for (let hop = 0; hop < maxHops; hop++) {
    const rows = await dbClient
      .select({ newSlug: slugRedirects.newSlug })
      .from(slugRedirects)
      .where(and(eq(slugRedirects.entity, entity), eq(slugRedirects.oldSlug, currentSlug)))
      .limit(1);

    if (rows.length === 0) {
      return currentSlug !== oldSlug ? currentSlug : null;
    }

    const nextSlug = rows[0]?.newSlug;
    if (!nextSlug || visited.has(nextSlug)) {
      // Loop detected or end of chain, return the last non-looping slug
      return currentSlug !== oldSlug ? currentSlug : null;
    }

    visited.add(nextSlug);
    currentSlug = nextSlug;
  }

  return currentSlug;
}
