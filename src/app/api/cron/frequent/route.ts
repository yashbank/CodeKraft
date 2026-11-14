import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runFrequentJobs } from "@/jobs/registry";

export const dynamic = "force-dynamic";

/**
 * Frequent Cron Endpoint (runs every 15 mins / frequent schedule).
 * Docs/06 §3.3, docs/12 §2.3.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reports = await runFrequentJobs();
  const hasErrors = reports.some((r) => r.status === "error");

  return NextResponse.json(
    {
      ok: !hasErrors,
      endpoint: "frequent",
      timestamp: new Date().toISOString(),
      reports,
    },
    { status: hasErrors ? 500 : 200 },
  );
}
