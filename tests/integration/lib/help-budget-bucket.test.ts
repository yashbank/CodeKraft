/** addToBucket / peekBucket: additive token counter on rate_limit_buckets (help budget). */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addToBucket, peekBucket } from "@/lib/rate-limit-pg";
import { migrateTestDb } from "../../setup/migrate";
import { getTestDb } from "../../setup/db";

describe("help budget bucket", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await getTestDb()`delete from rate_limit_buckets`;
  });

  it("accumulates amounts and peeks without writing", async () => {
    const key = "help:budget:2026-11";
    expect(await peekBucket(key)).toBe(0);
    expect(await addToBucket(key, 300, 60_000)).toBe(300);
    expect(await addToBucket(key, 120, 60_000)).toBe(420);
    expect(await peekBucket(key)).toBe(420);
    expect(await peekBucket(key)).toBe(420);
  });

  it("restarts after the window expires", async () => {
    await addToBucket("help:budget:x", 50, 200);
    await new Promise((r) => setTimeout(r, 300));
    expect(await peekBucket("help:budget:x")).toBe(0);
    expect(await addToBucket("help:budget:x", 7, 200)).toBe(7);
  });
});
