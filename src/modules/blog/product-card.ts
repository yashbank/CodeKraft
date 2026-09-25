/**
 * `ProductCard` for a blog detail page (API-CAT-33 `{ blog, product: ProductCard, html }`).
 * A self-contained builder over the catalog tables: the catalog module's card builder is the
 * canonical one (API-CAT-30); this one exists so the blog read has no runtime dependency on a
 * sibling that may still be a stub. Prices come from the active offerings' `offering_prices`
 * in the display currency, converted through `lib/fx` when only another currency is priced.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { getRate } from "@/lib/fx";
import { type Currency, type Money, convertMinor, isCurrency } from "@/lib/money";
import {
  categories,
  productMedia,
  productTags,
  products,
  tags,
  type Product,
} from "../../../drizzle/schema/catalog";
import { media } from "../../../drizzle/schema/media";
import { offeringPrices, offerings } from "../../../drizzle/schema/offerings";
import type { ProductCard } from "../catalog/types";
import { type MediaUrlResolver, defaultMediaUrl, imageRef } from "../content/internal";

export interface ProductCardDeps {
  mediaUrl?: MediaUrlResolver;
  /** `1 base = rate quote` as a decimal string, or `null` when unavailable. */
  rate?: (base: Currency, quote: Currency) => Promise<string | null>;
}

export const defaultRate: NonNullable<ProductCardDeps["rate"]> = async (base, quote) => {
  if (base === quote) return "1.00000000";
  try {
    return (await getRate(base, quote)).rate;
  } catch {
    return null;
  }
};

interface PriceRow {
  offeringId: string;
  currency: string;
  amountMinor: number;
  compareAtMinor: number | null;
}

/** Cheapest active offering in `display`, with its compare-at price when it has one. */
export async function resolveFromPrice(
  rows: readonly PriceRow[],
  display: Currency,
  rate: NonNullable<ProductCardDeps["rate"]>,
): Promise<{ fromPrice: Money | null; compareAtPrice?: Money }> {
  const byOffering = new Map<string, PriceRow[]>();
  for (const row of rows) {
    const list = byOffering.get(row.offeringId) ?? [];
    list.push(row);
    byOffering.set(row.offeringId, list);
  }
  let best: { amount: number; compareAt: number | null } | undefined;
  for (const list of byOffering.values()) {
    const exact = list.find((r) => r.currency === display);
    let candidate: { amount: number; compareAt: number | null } | undefined;
    if (exact !== undefined) {
      candidate = { amount: exact.amountMinor, compareAt: exact.compareAtMinor };
    } else {
      const base = list.find((r) => r.currency === "INR") ?? list[0];
      if (base !== undefined && isCurrency(base.currency)) {
        const fx = await rate(base.currency, display);
        if (fx !== null) {
          candidate = {
            amount: convertMinor(base.amountMinor, fx),
            compareAt: base.compareAtMinor === null ? null : convertMinor(base.compareAtMinor, fx),
          };
        }
      }
    }
    if (candidate !== undefined && (best === undefined || candidate.amount < best.amount)) best = candidate;
  }
  if (best === undefined) return { fromPrice: null };
  return {
    fromPrice: { amountMinor: best.amount, currency: display },
    ...(best.compareAt !== null && best.compareAt > best.amount
      ? { compareAtPrice: { amountMinor: best.compareAt, currency: display } }
      : {}),
  };
}

export async function buildProductCard(
  db: DbOrTx,
  product: Product,
  displayCurrency: Currency,
  deps: ProductCardDeps = {},
): Promise<ProductCard> {
  const resolve = deps.mediaUrl ?? defaultMediaUrl;
  const rate = deps.rate ?? defaultRate;

  const [category] =
    product.categoryId === null
      ? []
      : await db
          .select({ id: categories.id, slug: categories.slug, name: categories.name })
          .from(categories)
          .where(eq(categories.id, product.categoryId))
          .limit(1);

  const tagRows = await db
    .select({ id: tags.id, slug: tags.slug, name: tags.name })
    .from(productTags)
    .innerJoin(tags, eq(tags.id, productTags.tagId))
    .where(eq(productTags.productId, product.id))
    .orderBy(asc(tags.name));

  const [cover] = await db
    .select({ alt: productMedia.alt, media })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(and(eq(productMedia.productId, product.id), eq(productMedia.kind, "image")))
    .orderBy(asc(productMedia.position))
    .limit(1);

  const active = await db
    .select({
      id: offerings.id,
      purchaseModel: offerings.purchaseModel,
      deliveryType: offerings.deliveryType,
    })
    .from(offerings)
    .where(and(eq(offerings.productId, product.id), eq(offerings.status, "active")))
    .orderBy(asc(offerings.position));

  const priceRows: PriceRow[] =
    active.length === 0
      ? []
      : await db
          .select({
            offeringId: offeringPrices.offeringId,
            currency: offeringPrices.currency,
            amountMinor: offeringPrices.amountMinor,
            compareAtMinor: offeringPrices.compareAtMinor,
          })
          .from(offeringPrices)
          .where(
            inArray(
              offeringPrices.offeringId,
              active.map((o) => o.id),
            ),
          );

  const price = await resolveFromPrice(
    priceRows.map((r) => ({ ...r, currency: r.currency.trim() })),
    displayCurrency,
    rate,
  );

  return {
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    coverImage: cover === undefined ? null : imageRef(cover.media, cover.alt, resolve),
    category: category ?? null,
    tags: tagRows,
    fromPrice: price.fromPrice,
    ...(price.compareAtPrice !== undefined ? { compareAtPrice: price.compareAtPrice } : {}),
    purchaseModels: Array.from(new Set(active.map((o) => o.purchaseModel))),
    deliveryTypes: Array.from(new Set(active.map((o) => o.deliveryType))),
    isFeatured: product.isFeatured,
    isComingSoon: product.isComingSoon,
    currentVersion: product.currentVersion,
  };
}

/** Load a product row by id (or `undefined`). */
export async function findProduct(db: DbOrTx, productId: string): Promise<Product | undefined> {
  const [row] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  return row;
}
