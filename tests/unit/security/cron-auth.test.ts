import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/jobs/registry", () => ({
  runFrequentJobs: vi.fn(async () => []),
  runDailyJobs: vi.fn(async () => []),
}));

import { GET as frequent } from "@/app/api/cron/frequent/route";
import { GET as daily } from "@/app/api/cron/daily/route";
import { NextRequest } from "next/server";

const KEYS = ["CRON_SECRET", "NODE_ENV"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const env = process.env as Record<string, string | undefined>;

function req(auth?: string) {
  return new NextRequest("http://localhost/api/cron/x", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  delete env.CRON_SECRET;
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) Reflect.deleteProperty(env, k);
    else env[k] = saved[k];
  }
});

describe.each([
  ["frequent", frequent],
  ["daily", daily],
])("cron %s auth", (_name, handler) => {
  it("fails closed when CRON_SECRET is missing in production", async () => {
    env.NODE_ENV = "production";
    expect((await handler(req())).status).toBe(401);
    expect((await handler(req("Bearer anything"))).status).toBe(401);
  });
  it("stays open when CRON_SECRET is missing in test/development", async () => {
    env.NODE_ENV = "test";
    expect((await handler(req())).status).toBe(200);
    env.NODE_ENV = "development";
    expect((await handler(req())).status).toBe(200);
  });
  it("accepts the exact Vercel bearer header", async () => {
    env.NODE_ENV = "production";
    env.CRON_SECRET = "s3cret-value";
    expect((await handler(req("Bearer s3cret-value"))).status).toBe(200);
  });
  it("rejects wrong, missing and different-length secrets without throwing", async () => {
    env.NODE_ENV = "production";
    env.CRON_SECRET = "s3cret-value";
    expect((await handler(req())).status).toBe(401);
    expect((await handler(req("Bearer s3cret-valuf"))).status).toBe(401);
    expect((await handler(req("Bearer short"))).status).toBe(401);
    expect((await handler(req("Bearer s3cret-value-and-more"))).status).toBe(401);
    expect((await handler(req("s3cret-value"))).status).toBe(401);
  });
});
