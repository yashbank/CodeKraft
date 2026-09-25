import { describe, expect, it } from "vitest";

import { migrateTestDb } from "../../setup/migrate";

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "";

describe("GET /api/health (docs/06 §3.7)", () => {
  it("returns ok with db ok", async () => {
    await migrateTestDb();
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      db: string;
      version: string;
      time: string;
    };
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(body.version).toBeTruthy();
    expect(Date.parse(body.time)).not.toBeNaN();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
