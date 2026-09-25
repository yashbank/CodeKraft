/**
 * POST /api/files/upload-intent — docs/06 §3.5, API-CAT-21, PHASE-03 P3.5.
 */
import { NextResponse } from "next/server";
import { AppError, ErrorCode, toActionResult } from "@/lib/errors";
import { resolveRouteContext } from "@/lib/authz/resolve-route-context";
import { requireContext } from "@/lib/authz/context";
import { mediaService } from "@/modules/media/service";
import { createUploadIntentSchema } from "@/modules/media/contracts";

export async function POST(req: Request) {
  try {
    const ctx = await resolveRouteContext(req);
    const authedCtx = requireContext(ctx);

    const body = await req.json().catch(() => ({}));
    const parse = createUploadIntentSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION,
            message: parse.error.issues[0]?.message ?? "Invalid input",
            fields: Object.fromEntries(
              parse.error.issues.map((i) => [i.path.join("."), [i.message]]),
            ),
          },
        },
        { status: 400 },
      );
    }

    const result = await mediaService.createUploadIntent(authedCtx, parse.data);
    return NextResponse.json({ ok: true, data: result });
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
