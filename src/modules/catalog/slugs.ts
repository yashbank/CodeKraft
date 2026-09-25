/**
 * Slugs and slug redirects (docs/06 §1.3 slug rule, MASTER_SPEC §7 "Slug changes", FR-SEO).
 * A slug change on a published entity records `slug_redirects(entity, old_slug → new_slug)`;
 * chains are collapsed so every stored redirect points at the current slug, and a redirect whose
 * `old_slug` is the new slug is removed (no loops).
 */
import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { slugRedirects } from "../../../drizzle/schema/catalog";
import type { SlugRedirectEntity } from "./types";

/** `"Next.js & Postgres!"` → `"next-js-postgres"` (docs/06 §1.3 pattern, max 80). */
export function slugify(input: string, max = 80): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  const cut = base.slice(0, max).replace(/-+$/g, "");
  return cut === "" ? "item" : cut;
}

/** `slug-2`, `slug-3`, … keeping the total under `max`. */
export function suffixSlug(slug: string, n: number, max = 80): string {
  const suffix = `-${String(n)}`;
  return `${slug.slice(0, max - suffix.length).replace(/-+$/g, "")}${suffix}`;
}

export async function recordSlugRedirect(
  entity: SlugRedirectEntity,
  oldSlug: string,
  newSlug: string,
  db: DbOrTx,
): Promise<void> {
  if (oldSlug === newSlug) return;
  // The new slug is live again: drop any redirect away from it.
  await db
    .delete(slugRedirects)
    .where(and(eq(slugRedirects.entity, entity), eq(slugRedirects.oldSlug, newSlug)));
  // Collapse chains: everything that pointed at the old slug now points at the new one.
  await db
    .update(slugRedirects)
    .set({ newSlug })
    .where(and(eq(slugRedirects.entity, entity), eq(slugRedirects.newSlug, oldSlug)));
  await db
    .insert(slugRedirects)
    .values({ entity, oldSlug, newSlug })
    .onConflictDoUpdate({
      target: [slugRedirects.entity, slugRedirects.oldSlug],
      set: { newSlug },
    });
}

/** The current slug an old one redirects to, or `null`. */
export async function resolveRedirect(
  entity: SlugRedirectEntity,
  slug: string,
  db: DbOrTx,
): Promise<string | null> {
  const [row] = await db
    .select({ newSlug: slugRedirects.newSlug })
    .from(slugRedirects)
    .where(and(eq(slugRedirects.entity, entity), eq(slugRedirects.oldSlug, slug)))
    .limit(1);
  return row?.newSlug ?? null;
}
