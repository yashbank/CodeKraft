/**
 * `ProductCard` builder (docs/06 API-CAT-30/34/36): one batched load for a set of product ids —
 * category, tags, cover image, active offerings with prices resolved to the display currency
 * (D-502). Shared by search, featured and wishlist reads. Never touches ownership (BR-02).
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import type { Currency, Money } from "@/lib/money";
import { resolvePrice } from "@/modules/offerings/pricing";
import { offeringPrices, offerings } from "../../../drizzle/schema/offerings";
import { categories, productMedia, products } from "../../../drizzle/schema/catalog";
import { media } from "../../../drizzle/schema/media";
import type { CatalogReadDeps } from "./deps";
import { loadTagsFor } from "./tags";
import type { ImageRef, ProductCard } from "./types";
import { toCategoryRef, toImageRef } from "./views";

/** Kinds that can serve as a card cover, in preference order. */
export const COVER_KINDS = ["image", "screenshot", "gallery"] as const;

export async function loadCoverImages(
  productIds: readonly string[],
  deps: Pick<CatalogReadDeps, "mediaUrl">,
  db: DbOrTx,
): Promise<Map<string, ImageRef>> {
  const out = new Map<string, ImageRef>();
  if (productIds.length === 0) return out;
  const rows = await db
    .select({ pm: productMedia, m: media })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(
      and(inArray(productMedia.productId, [...productIds]), inArray(productMedia.kind, [...COVER_KINDS])),
    )
    .orderBy(asc(productMedia.position), asc(productMedia.createdAt));
  const rank = (k: string) => (COVER_KINDS as readonly string[]).indexOf(k);
  const best = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const current = best.get(row.pm.productId);
    if (current === undefined || rank(row.pm.kind) < rank(current.pm.kind)) {
      best.set(row.pm.productId, row);
    }
  }
  for (const [productId, row] of best) {
    out.set(productId, toImageRef(row.m, await deps.mediaUrl(row.m), row.pm.alt));
  }
  return out;
}

export interface PriceSummary {
  fromPrice: Money | null;
  compareAtPrice?: Money;
  purchaseModels: ProductCard["purchaseModels"];
  deliveryTypes: ProductCard["deliveryTypes"];
}

/** Active offerings per product → `fromPrice` (lowest display price), models and delivery types. */
export async function loadPriceSummaries(
  productIds: readonly string[],
  displayCurrency: Currency,
  deps: Pick<CatalogReadDeps, "baseCurrency" | "rate">,
  db: DbOrTx,
): Promise<Map<string, PriceSummary>> {
  const out = new Map<string, PriceSummary>();
  if (productIds.length === 0) return out;
  const baseCurrency = await deps.baseCurrency(db);
  const rate = await deps.rate(baseCurrency, displayCurrency);
  const rows = await db
    .select()
    .from(offerings)
    .where(and(inArray(offerings.productId, [...productIds]), eq(offerings.status, "active")))
    .orderBy(asc(offerings.position));
  const priceRows =
    rows.length === 0
      ? []
      : await db
          .select()
          .from(offeringPrices)
          .where(
            inArray(
              offeringPrices.offeringId,
              rows.map((o) => o.id),
            ),
          );
  const pricesByOffering = new Map<string, typeof priceRows>();
  for (const p of priceRows) {
    const list = pricesByOffering.get(p.offeringId) ?? [];
    list.push(p);
    pricesByOffering.set(p.offeringId, list);
  }
  for (const o of rows) {
    const summary = out.get(o.productId) ?? {
      fromPrice: null,
      purchaseModels: [],
      deliveryTypes: [],
    };
    if (!summary.purchaseModels.includes(o.purchaseModel)) summary.purchaseModels.push(o.purchaseModel);
    if (!summary.deliveryTypes.includes(o.deliveryType)) summary.deliveryTypes.push(o.deliveryType);
    if (o.purchaseModel !== "custom_quote") {
      const resolved = resolvePrice(pricesByOffering.get(o.id) ?? [], baseCurrency, displayCurrency, rate);
      if (
        resolved !== null &&
        (summary.fromPrice === null || resolved.display.amountMinor < summary.fromPrice.amountMinor)
      ) {
        summary.fromPrice = resolved.display;
        if (resolved.compareAt !== null) summary.compareAtPrice = resolved.compareAt;
        else delete summary.compareAtPrice;
      }
    }
    out.set(o.productId, summary);
  }
  return out;
}

/** Cards for `productIds`, in the given order; ids that do not exist are skipped. */
export async function loadProductCards(
  productIds: readonly string[],
  displayCurrency: Currency,
  deps: CatalogReadDeps,
  db: DbOrTx,
): Promise<ProductCard[]> {
  if (productIds.length === 0) return [];
  const rows = await db
    .select({ p: products, c: categories })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(inArray(products.id, [...productIds]));
  const byId = new Map(rows.map((r) => [r.p.id, r]));
  const [tagsFor, covers, prices] = await Promise.all([
    loadTagsFor(productIds, db),
    loadCoverImages(productIds, deps, db),
    loadPriceSummaries(productIds, displayCurrency, deps, db),
  ]);
  const cards: ProductCard[] = [];
  for (const id of productIds) {
    const row = byId.get(id);
    if (row === undefined) continue;
    const summary = prices.get(id);
    const card: ProductCard = {
      slug: row.p.slug,
      name: row.p.name,
      shortDescription: row.p.shortDescription,
      coverImage: covers.get(id) ?? null,
      category: toCategoryRef(row.c),
      tags: tagsFor.get(id) ?? [],
      fromPrice: summary?.fromPrice ?? null,
      purchaseModels: summary?.purchaseModels ?? [],
      deliveryTypes: summary?.deliveryTypes ?? [],
      isFeatured: row.p.isFeatured,
      isComingSoon: row.p.isComingSoon,
      currentVersion: row.p.currentVersion,
    };
    if (summary?.compareAtPrice !== undefined) card.compareAtPrice = summary.compareAtPrice;
    cards.push(card);
  }
  return cards;
}
