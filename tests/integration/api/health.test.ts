import { describe, expect, it } from "vitest";

import { migrateTestDb } from "../../setup/migrate";

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "";

describe("GET /api/health (docs/06 §3.7)", () => {
  it("returns only {ok,status} (BUG-075)", async () => {
    await migrateTestDb();
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
