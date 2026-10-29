/**
 * GET /api/admin/orders/alerts?since=<ISO> — new orders since a timestamp, for the admin toast.
 * Polling only (no websockets); the client calls it every ~45 s while the tab is visible.
 */
import { NextResponse } from "next/server";
import { requireContext } from "@/lib/authz/context";
import { resolveRouteContext } from "@/lib/authz/resolve-route-context";
import { ErrorCode, isAppError } from "@/lib/errors";
import { newOrdersSince } from "@/modules/orders/alerts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = requireContext(await resolveRouteContext(req));
    const raw = new URL(req.url).searchParams.get("since");
    const since = new Date(raw ?? "");
    if (!raw || Number.isNaN(since.getTime())) {
      return NextResponse.json(
        { ok: false, error: { code: ErrorCode.VALIDATION, message: "Invalid since timestamp" } },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, data: await newOrdersSince(ctx, since) });
  } catch (caught) {
    const status = isAppError(caught) ? caught.httpStatus : 500;
    const code = isAppError(caught) ? caught.code : ErrorCode.INTERNAL;
    return NextResponse.json({ ok: false, error: { code } }, { status });
  }
}
