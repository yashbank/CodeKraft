import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.APP_VERSION ?? "dev";

/** docs/06 §3.7 — 200 ok after SELECT 1, 503 degraded otherwise. Used by uptime ping and Docker HEALTHCHECK. */
export async function GET(): Promise<NextResponse> {
  const time = new Date().toISOString();
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json(
      { status: "ok", db: "ok", version: VERSION, time },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "error", version: VERSION, time },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
