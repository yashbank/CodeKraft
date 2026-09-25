/**
 * `slug_redirects` (MASTER_SPEC §7 "Slug changes", docs/11): when a published entity's slug
 * changes the old slug 301s to the new one. Shared by case studies (`case_study`) and blogs
 * (`blog`); products are the catalog's.
 */
import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { slugRedirects, type SlugRedirect } from "../../../drizzle/schema/catalog";
import type { SlugRedirectEntity } from "../catalog/types";

/**
 * Record `oldSlug → newSlug`. Existing redirects that pointed at `oldSlug` are re-targeted so
 * chains stay one hop, and a redirect whose old slug is now the live slug is removed (no loops).
 */
export async function recordSlugRedirect(
  tx: DbOrTx,
  entity: SlugRedirectEntity,
  oldSlug: string,
  newSlug: string,
): Promise<SlugRedirect | null> {
  if (oldSlug === newSlug) return null;
  await tx
    .delete(slugRedirects)
    .where(and(eq(slugRedirects.entity, entity), eq(slugRedirects.oldSlug, newSlug)));
  await tx
    .update(slugRedirects)
    .set({ newSlug })
    .where(and(eq(slugRedirects.entity, entity), eq(slugRedirects.newSlug, oldSlug)));
  const [row] = await tx
    .insert(slugRedirects)
    .values({ entity, oldSlug, newSlug })
    .onConflictDoUpdate({
      target: [slugRedirects.entity, slugRedirects.oldSlug],
      set: { newSlug },
    })
    .returning();
  return row ?? null;
}

/** The live slug an old slug redirects to, or `null` when there is no redirect. */
export async function resolveSlugRedirect(
  db: DbOrTx,
  entity: SlugRedirectEntity,
  slug: string,
): Promise<string | null> {
  const [row] = await db
    .select({ newSlug: slugRedirects.newSlug })
    .from(slugRedirects)
    .where(and(eq(slugRedirects.entity, entity), eq(slugRedirects.oldSlug, slug)))
    .limit(1);
  return row?.newSlug ?? null;
}
