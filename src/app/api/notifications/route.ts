/**
 * GET /api/notifications — docs/06 §3.8, PHASE-06 P6.1.
 * Poll notifications since given timestamp.
 */
import { NextResponse } from "next/server";
import { resolveRouteContext } from "@/lib/authz/resolve-route-context";
import { requireContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { notificationsService } from "@/modules/notifications/service";
import { pollNotificationsSchema } from "@/modules/notifications/types";

export async function GET(req: Request) {
  try {
    const ctx = await resolveRouteContext(req);
    const authedCtx = requireContext(ctx);

    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get("since") ?? new Date(0).toISOString();

    const parse = pollNotificationsSchema.safeParse({ since: sinceParam });
    if (!parse.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION,
            message: parse.error.issues[0]?.message ?? "Invalid since timestamp",
          },
        },
        { status: 400 },
      );
    }

    const result = await notificationsService.pollNotifications(authedCtx, parse.data);
    return NextResponse.json({ ok: true, data: result });
  } catch (err: any) {
    const status = err.statusCode ?? 500;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: err.code ?? ErrorCode.INTERNAL,
          message: err.message ?? "Failed to fetch notifications",
        },
      },
      { status },
    );
  }
}
