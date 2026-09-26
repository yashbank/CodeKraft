/**
 * GET /api/files/download/[entitlementId]/[mediaId] — docs/06 §3.5, PHASE-05 P5.3.
 * Customer download link route: 302 redirect to presigned R2 GET URL.
 */
import { NextResponse } from "next/server";
import { AppError, ErrorCode, toActionResult } from "@/lib/errors";
import { resolveRouteContext } from "@/lib/authz/resolve-route-context";
import { requireContext } from "@/lib/authz/context";
import { entitlementsService } from "@/modules/entitlements/service";
import { issueDownloadLinkSchema } from "@/modules/entitlements/types";

export async function GET(
  req: Request,
  props: { params: Promise<{ entitlementId: string; mediaId: string }> },
) {
  try {
    const params = await props.params;
    const ctx = await resolveRouteContext(req);
    const authedCtx = requireContext(ctx);

    const parse = issueDownloadLinkSchema.safeParse({
      entitlementId: params.entitlementId,
      mediaId: params.mediaId,
    });

    if (!parse.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION,
            message: parse.error.issues[0]?.message ?? "Invalid parameters",
          },
        },
        { status: 400 },
      );
    }

    const { url } = await entitlementsService.issueDownloadLink(authedCtx, parse.data);
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
              : err.code === ErrorCode.LIMIT_EXCEEDED
                ? 429
                : err.code === ErrorCode.VALIDATION || err.code === ErrorCode.STATE_INVALID
                  ? 409
                  : 500
        : 500;
    return NextResponse.json(res, { status });
  }
}
