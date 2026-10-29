/**
 * GET /api/files/attachment/[mediaId] — P14-06. Streams a chat/query attachment from private
 * storage to the uploader, the customer who owns the thread, or an admin with the read
 * permission. Everyone else gets 404. `?download=1` forces a download; images/PDFs otherwise
 * open inline (the type allow-list excludes SVG/HTML; nosniff is set).
 */
import { NextResponse } from "next/server";
import { resolveRouteContext } from "@/lib/authz/resolve-route-context";
import { getDb } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { getStorageDriver } from "@/lib/storage";
import { getReadableAttachment } from "@/modules/media/attachments";
import { uuidSchema } from "@/modules/_shared/zod";

const INLINE = /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/;

export async function GET(req: Request, props: { params: Promise<{ mediaId: string }> }) {
  try {
    const { mediaId } = await props.params;
    if (!uuidSchema.safeParse(mediaId).success) throw new AppError(ErrorCode.NOT_FOUND);
    const ctx = await resolveRouteContext(req);
    const row = await getReadableAttachment(getDb(), ctx, mediaId);
    const { body } = await getStorageDriver().getObject(row.bucket, row.objectKey);
    const download = new URL(req.url).searchParams.get("download") === "1";
    const disposition = download || !INLINE.test(row.mime) ? "attachment" : "inline";
    const name = encodeURIComponent(row.originalName ?? "attachment");
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": row.mime,
        "Content-Length": String(body.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${name}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const status =
      err instanceof AppError && err.code === ErrorCode.UNAUTHENTICATED
        ? 401
        : err instanceof AppError && err.code === ErrorCode.NOT_FOUND
          ? 404
          : 500;
    return NextResponse.json({ ok: false, error: { message: "Not found" } }, { status });
  }
}
