import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * docs/06 §3.7 — 200 ok after SELECT 1, 503 degraded otherwise. Used by uptime ping and Docker HEALTHCHECK.
 * BUG-075: public body is only {ok,status}; no version/commit/DB detail is exposed.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json(
      { ok: true, status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, status: "degraded" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
