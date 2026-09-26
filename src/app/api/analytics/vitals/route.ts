/**
 * POST /api/analytics/vitals — docs/11 §B10, PHASE-06 P6.8.
 * Ingests Web Vitals metrics via sendBeacon.
 */
import { NextResponse } from "next/server";
import { anonymousContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { analyticsService } from "@/modules/analytics/service";
import { webVitalSchema } from "@/modules/analytics/types";

export async function POST(req: Request) {
  try {
    const ctx = anonymousContext();
    const body = await req.json();

    const parse = webVitalSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION,
            message: parse.error.issues[0]?.message ?? "Invalid vital data",
          },
        },
        { status: 400 }
      );
    }

    await analyticsService.trackWebVital(ctx, parse.data);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: ErrorCode.INTERNAL,
          message: "Failed to record web vital",
        },
      },
      { status: 500 }
    );
  }
}
