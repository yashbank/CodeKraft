import { NextResponse, type NextRequest } from "next/server";
import { runDailyJobs } from "@/jobs/registry";

export const dynamic = "force-dynamic";

/**
 * Daily Cron Endpoint (runs once a day / 00:00 UTC schedule).
 * Docs/06 §3.3, docs/12 §2.3.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reports = await runDailyJobs();
  const hasErrors = reports.some((r) => r.status === "error");

  return NextResponse.json(
    {
      ok: !hasErrors,
      endpoint: "daily",
      timestamp: new Date().toISOString(),
      reports,
    },
    { status: hasErrors ? 500 : 200 }
  );
}
