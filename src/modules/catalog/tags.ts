/**
 * Tags and the `products.tag_names` denormalisation (FR-CAT-07 search bridge — the generated
 * `search_vector` cannot read `tags`, so the catalog service refreshes `tag_names` after every
 * `product_tags` change).
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { productTags, products, tags } from "../../../drizzle/schema/catalog";
import { isUniqueViolation } from "@/modules/approvals/pg-errors";
import { slugify, suffixSlug } from "./slugs";
import type { TagRef } from "./types";

/** Find-or-create tags by name (case-insensitive match on `name`); returns ids in input order. */
export async function ensureTags(names: readonly string[], db: DbOrTx): Promise<string[]> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter((n) => n !== ""))];
  if (wanted.length === 0) return [];
  const existing = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(
      inArray(
        sql`lower(${tags.name})`,
        wanted.map((n) => n.toLowerCase()),
      ),
    );
  const byLower = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));
  const ids: string[] = [];
  for (const name of wanted) {
    const found = byLower.get(name.toLowerCase());
    if (found !== undefined) {
      ids.push(found);
      continue;
    }
    ids.push(await insertTagWithFreeSlug(name, db));
  }
  return ids;
}

async function insertTagWithFreeSlug(name: string, db: DbOrTx): Promise<string> {
  const base = slugify(name, 80);
  for (let n = 1; n <= 20; n += 1) {
    const slug = n === 1 ? base : suffixSlug(base, n);
    try {
      const [row] = await db.insert(tags).values({ name, slug }).returning({ id: tags.id });
      if (row !== undefined) return row.id;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // A concurrent insert of the same name wins: reuse it.
      const [same] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(sql`lower(${tags.name}) = ${name.toLowerCase()}`)
        .limit(1);
      if (same !== undefined) return same.id;
    }
  }
  throw new Error(`could not allocate a slug for tag ${JSON.stringify(name)}`);
}

/** Replace a product's tag set and refresh `tag_names`. */
export async function setProductTags(
  productId: string,
  tagIds: readonly string[],
  db: DbOrTx,
): Promise<void> {
  await db.delete(productTags).where(eq(productTags.productId, productId));
  if (tagIds.length > 0) {
    await db
      .insert(productTags)
      .values([...new Set(tagIds)].map((tagId) => ({ productId, tagId })))
      .onConflictDoNothing();
  }
  await refreshTagNames(productId, db);
}

/** `products.tag_names := array_agg(tags.name)` for one product. */
export async function refreshTagNames(productId: string, db: DbOrTx): Promise<void> {
  await db
    .update(products)
    .set({
      tagNames: sql`coalesce((select array_agg(t.name order by t.name) from ${productTags} pt join ${tags} t on t.id = pt.tag_id where pt.product_id = ${products.id}), '{}'::text[])`,
    })
    .where(eq(products.id, productId));
}

/** Refresh every product carrying `tagId` (after a tag rename). */
export async function refreshTagNamesForTag(tagId: string, db: DbOrTx): Promise<void> {
  const rows = await db
    .select({ productId: productTags.productId })
    .from(productTags)
    .where(eq(productTags.tagId, tagId));
  for (const row of rows) await refreshTagNames(row.productId, db);
}

/** Tags of many products in one query (`Map<productId, TagRef[]>`, sorted by name). */
export async function loadTagsFor(
  productIds: readonly string[],
  db: DbOrTx,
): Promise<Map<string, TagRef[]>> {
  const out = new Map<string, TagRef[]>();
  if (productIds.length === 0) return out;
  const rows = await db
    .select({ productId: productTags.productId, id: tags.id, slug: tags.slug, name: tags.name })
    .from(productTags)
    .innerJoin(tags, eq(tags.id, productTags.tagId))
    .where(inArray(productTags.productId, [...productIds]))
    .orderBy(tags.name);
  for (const row of rows) {
    const list = out.get(row.productId) ?? [];
    list.push({ id: row.id, slug: row.slug, name: row.name });
    out.set(row.productId, list);
  }
  return out;
}

export async function productHasTag(productId: string, tagId: string, db: DbOrTx): Promise<boolean> {
  const [row] = await db
    .select({ tagId: productTags.tagId })
    .from(productTags)
    .where(and(eq(productTags.productId, productId), eq(productTags.tagId, tagId)))
    .limit(1);
  return row !== undefined;
}
