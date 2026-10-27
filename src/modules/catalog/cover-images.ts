/**
 * Product primary image ("cover") resolution — R8-13.
 *
 * The product detail page renders every `product_media` row, but list surfaces (home featured,
 * /products, search, wishlist, related, account, cart/checkout) only get a `ProductCard`, whose
 * `coverImage` used to be hard-coded `null`. This loads the primary image for many products in
 * one query: the first (lowest-position) image/screenshot/gallery row — the same order the admin
 * Media tab lists and the detail gallery uses. Ties break toward `kind = 'image'`.
 */
import { and, asc, inArray, isNotNull, sql } from "drizzle-orm";

import { productMedia } from "../../../drizzle/schema/catalog";
import { media } from "../../../drizzle/schema/media";
import type { DbOrTx } from "@/lib/db";
import { getPublicMediaBaseUrl } from "@/lib/storage";

import type { ImageRef } from "./types";

const COVER_KINDS = ["image", "screenshot", "gallery"] as const;

/** Tie-break rank for equal positions: explicit images, then screenshots, then gallery. */
export function coverKindRank(kind: string): number {
  const i = (COVER_KINDS as readonly string[]).indexOf(kind);
  return i === -1 ? COVER_KINDS.length : i;
}

export function publicMediaUrl(m: { id: string; objectKey: string; visibility: string }): string {
  if (m.visibility === "public") {
    return `${getPublicMediaBaseUrl().replace(/\/+$/, "")}/${m.objectKey}`;
  }
  return `/api/files/private/${m.id}`;
}

export interface CoverCandidate {
  productId: string;
  kind: string;
  position: number;
  alt: string;
  mime: string;
  media: { id: string; objectKey: string; visibility: string };
  width: number | null;
  height: number | null;
  blurHash: string | null;
}

/** Pure selection step (unit-tested): one cover per product from candidate rows. */
export function pickCovers(rows: readonly CoverCandidate[]): Map<string, ImageRef> {
  const best = new Map<string, CoverCandidate>();
  for (const r of rows) {
    if (!r.mime.startsWith("image/")) continue;
    const cur = best.get(r.productId);
    if (
      !cur ||
      r.position < cur.position ||
      (r.position === cur.position && coverKindRank(r.kind) < coverKindRank(cur.kind))
    ) {
      best.set(r.productId, r);
    }
  }
  const out = new Map<string, ImageRef>();
  for (const [productId, r] of best) {
    out.set(productId, {
      mediaId: r.media.id,
      url: publicMediaUrl(r.media),
      alt: r.alt,
      width: r.width,
      height: r.height,
      blurHash: r.blurHash,
    });
  }
  return out;
}

/** Loads the primary image for each product id (missing ids simply have no entry). */
export async function loadProductCovers(
  db: DbOrTx,
  productIds: readonly string[],
): Promise<Map<string, ImageRef>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      productId: productMedia.productId,
      kind: productMedia.kind,
      position: productMedia.position,
      alt: productMedia.alt,
      mediaId: media.id,
      objectKey: media.objectKey,
      visibility: media.visibility,
      mime: media.mime,
      width: media.width,
      height: media.height,
      blurHash: media.blurHash,
    })
    .from(productMedia)
    .innerJoin(media, sql`${productMedia.mediaId} = ${media.id}`)
    .where(
      and(
        inArray(productMedia.productId, ids),
        inArray(productMedia.kind, [...COVER_KINDS]),
        isNotNull(productMedia.mediaId),
      ),
    )
    .orderBy(asc(productMedia.position));
  return pickCovers(
    rows.map((r) => ({
      productId: r.productId,
      kind: r.kind,
      position: r.position,
      alt: r.alt,
      mime: r.mime,
      media: { id: r.mediaId, objectKey: r.objectKey, visibility: r.visibility },
      width: r.width,
      height: r.height,
      blurHash: r.blurHash,
    })),
  );
}

/** Convenience for single-product server pages (checkout, quote): the cover URL or undefined. */
export async function getProductCoverUrl(productId: string): Promise<string | undefined> {
  const { getDb } = await import("@/lib/db");
  return (await loadProductCovers(getDb(), [productId])).get(productId)?.url;
}
