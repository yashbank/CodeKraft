/** Postgres rate-limit store: persistence, window reset, concurrency, fail-open, purge. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresRateLimitStore } from "@/lib/rate-limit-pg";
import { InMemoryRateLimitStore } from "@/lib/rate-limit";
import { rateLimitPurgeJob } from "@/jobs/rate-limit-purge";
import { migrateTestDb } from "../../setup/migrate";
import { getTestDb } from "../../setup/db";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("PostgresRateLimitStore", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await getTestDb()`delete from rate_limit_buckets`;
  });

  it("allows up to the limit then blocks, with decreasing remaining", async () => {
    const s = new PostgresRateLimitStore();
    const a = await s.hit("t:ip:1", 3, 60_000);
    const b = await s.hit("t:ip:1", 3, 60_000);
    const c = await s.hit("t:ip:1", 3, 60_000);
    const d = await s.hit("t:ip:1", 3, 60_000);
    expect([a.allowed, b.allowed, c.allowed, d.allowed]).toEqual([true, true, true, false]);
    expect([a.remaining, b.remaining, c.remaining, d.remaining]).toEqual([2, 1, 0, 0]);
    expect(d.resetAt).toBeGreaterThan(Date.now());
    expect((await s.hit("t:ip:other", 3, 60_000)).allowed).toBe(true);
  });

  it("is shared across store instances (cold starts)", async () => {
    await new PostgresRateLimitStore().hit("t:ip:2", 1, 60_000);
    const second = await new PostgresRateLimitStore().hit("t:ip:2", 1, 60_000);
    expect(second.allowed).toBe(false);
  });

  it("resets after the window expires", async () => {
    const s = new PostgresRateLimitStore();
    expect((await s.hit("t:ip:3", 1, 400)).allowed).toBe(true);
    expect((await s.hit("t:ip:3", 1, 400)).allowed).toBe(false);
    await sleep(600);
    const again = await s.hit("t:ip:3", 1, 400);
    expect(again.allowed).toBe(true);
    expect(again.remaining).toBe(0);
  });

  it("is atomic under concurrency: exactly `limit` of N parallel hits pass", async () => {
    const s = new PostgresRateLimitStore();
    const results = await Promise.all(
      Array.from({ length: 40 }, () => s.hit("t:ip:4", 10, 60_000)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    const [row] = await getTestDb()<{ count: number }[]>`
      select count from rate_limit_buckets where key = 't:ip:4'`;
    expect(row?.count).toBe(40);
  });

  it("fails open on the in-memory fallback when the DB errors", async () => {
    const fallback = new InMemoryRateLimitStore();
    const s = new PostgresRateLimitStore(() => Promise.reject(new Error("db down")), fallback);
    expect((await s.hit("t:ip:5", 1, 60_000)).allowed).toBe(true);
    expect((await s.hit("t:ip:5", 1, 60_000)).allowed).toBe(false); // fallback still limits
  });

  it("fails open when the DB hangs past the timeout", async () => {
    const s = new PostgresRateLimitStore(
      () => new Promise(() => undefined),
      new InMemoryRateLimitStore(),
      50,
    );
    expect((await s.hit("t:ip:6", 2, 60_000)).allowed).toBe(true);
  });

  it("rejects invalid limit/window", async () => {
    const s = new PostgresRateLimitStore();
    await expect(s.hit("k", 0, 1000)).rejects.toThrow(RangeError);
    await expect(s.hit("k", 1, 0)).rejects.toThrow(RangeError);
  });

  it("purge job deletes only expired buckets", async () => {
    const s = new PostgresRateLimitStore();
    await s.hit("t:old", 1, 1);
    await s.hit("t:live", 1, 60_000);
    await sleep(20);
    const res = await rateLimitPurgeJob.run(new Date());
    expect(res.detail.purgedBuckets).toBe(1);
    const rows = await getTestDb()<{ key: string }[]>`select key from rate_limit_buckets`;
    expect(rows.map((r) => r.key)).toEqual(["t:live"]);
  });
});
