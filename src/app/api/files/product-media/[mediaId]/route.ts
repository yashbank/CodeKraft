/**
 * GET /api/files/product-media/[mediaId]
 *
 * Streams a private product media object inline (PDF preview / "View PDF").
 * Visitors: only media attached as `presentation` to a PUBLISHED product. Admin-class users:
 * any media attached to any product. Everything else is a 404 (no existence leak).
 */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isAdminClass } from "@/lib/authz/assert";
import { resolveRouteContext } from "@/lib/authz/resolve-route-context";
import { getPrivateBucketName, getStorageDriver } from "@/lib/storage";
import { canVisitorViewProductMedia } from "@/modules/catalog/media-access";

import { productMedia, products } from "../../../../../../drizzle/schema/catalog";
import { media } from "../../../../../../drizzle/schema/media";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () =>
  NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });

export async function GET(req: Request, props: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await props.params;
  if (!UUID_RE.test(mediaId)) return notFound();
  try {
    const { db } = await import("@/lib/db");
    const rows = await db
      .select({
        kind: productMedia.kind,
        productStatus: products.status,
        objectKey: media.objectKey,
        mime: media.mime,
      })
      .from(productMedia)
      .innerJoin(media, eq(productMedia.mediaId, media.id))
      .innerJoin(products, eq(productMedia.productId, products.id))
      .where(and(eq(media.id, mediaId)));
    const first = rows[0];
    if (!first) return notFound();

    let allowed = canVisitorViewProductMedia(rows);
    if (!allowed) {
      const ctx = await resolveRouteContext(req);
      allowed = isAdminClass(ctx);
    }
    if (!allowed) return notFound();

    const obj = await getStorageDriver().getObject(getPrivateBucketName(), first.objectKey);
    return new NextResponse(new Uint8Array(obj.body), {
      status: 200,
      headers: {
        "Content-Type": first.mime || obj.contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
