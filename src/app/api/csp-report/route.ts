import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit-port";

export const dynamic = "force-dynamic";

/**
 * CSP violation report ingest (docs/09 §9, P9.1).
 * Logs CSP violation reports to the audit port and server logs for monitoring.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let report: unknown = null;

    if (contentType.includes("application/csp-report") || contentType.includes("application/json")) {
      report = await req.json();
    } else {
      const text = await req.text();
      try {
        report = JSON.parse(text);
      } catch {
        report = { raw: text };
      }
    }

    // Log CSP violation report
    await audit({
      action: "system.csp_violation" as any,
      actorId: null,
      meta: {
        report,
        ip: req.headers.get("x-forwarded-for") ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
