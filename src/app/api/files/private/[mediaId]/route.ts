/**
 * GET /api/files/private/[mediaId] — docs/06 §3.5, PHASE-03 P3.5.
 *
 * Admin-only 302 redirect to presigned GET, audited.
 */
import { NextResponse } from "next/server";
import { AppError, ErrorCode, toActionResult } from "@/lib/errors";
import { resolveRouteContext } from "@/lib/authz/resolve-route-context";
import { requireContext } from "@/lib/authz/context";
import { mediaService } from "@/modules/media/service";
import { privateMediaLinkSchema } from "@/modules/media/contracts";

export async function GET(req: Request, props: { params: Promise<{ mediaId: string }> }) {
  try {
    const params = await props.params;
    const ctx = await resolveRouteContext(req);
    const authedCtx = requireContext(ctx);

    const parse = privateMediaLinkSchema.safeParse({ mediaId: params.mediaId });
    if (!parse.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION,
            message: parse.error.issues[0]?.message ?? "Invalid media id",
          },
        },
        { status: 400 },
      );
    }

    const { url } = await mediaService.getPrivateMediaUrl(authedCtx, parse.data);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    const res = toActionResult(err);
    const status =
      err instanceof AppError
        ? err.code === ErrorCode.UNAUTHENTICATED
          ? 401
          : err.code === ErrorCode.FORBIDDEN
            ? 403
            : err.code === ErrorCode.NOT_FOUND
              ? 404
              : err.code === ErrorCode.VALIDATION || err.code === ErrorCode.STATE_INVALID
                ? 400
                : 500
        : 500;
    return NextResponse.json(res, { status });
  }
}
