// @vitest-environment node
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.example", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && m[2] !== "" && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}
process.env.APP_ENV ??= "test";

import { describe, expect, it, vi } from "vitest";
import { resolveHostKind } from "@/middleware";
import { checkClass, assertRateLimit, InMemoryRateLimitStore, setRateLimitStore } from "@/lib/rate-limit";
import { runFrequentJobs, runDailyJobs } from "@/jobs/registry";

describe("Phase 9: Hardening & Performance Verification", () => {
  it("P9.1: resolveHostKind correctly identifies host routing", () => {
    expect(resolveHostKind("")).toBe("site");
    expect(resolveHostKind("localhost:3000")).toBe("site");
  });

  it("P9.2: Rate limiting enforces bucket limits and allows within quota", async () => {
    const store = new InMemoryRateLimitStore();
    setRateLimitStore(store);

    const key = "test-user-rate-limit";
    const res1 = await assertRateLimit(key, 2, 60000);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(1);

    const res2 = await assertRateLimit(key, 2, 60000);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(0);

    await expect(assertRateLimit(key, 2, 60000)).rejects.toThrow();
  });

  it("P9.2: checkClass evaluates rate-limiting classes", async () => {
    const store = new InMemoryRateLimitStore();
    setRateLimitStore(store);

    const result = await checkClass("public_form", { ip: "127.0.0.1" });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("P9.4: runFrequentJobs and runDailyJobs execute registered jobs and return reports", async () => {
    const now = new Date("2026-09-26T12:00:00Z");

    const frequentReports = await runFrequentJobs(now);
    expect(Array.isArray(frequentReports)).toBe(true);
    expect(frequentReports.length).toBeGreaterThan(0);
    for (const report of frequentReports) {
      expect(report.job).toBeDefined();
      expect(typeof report.durationMs).toBe("number");
    }

    const dailyReports = await runDailyJobs(now);
    expect(Array.isArray(dailyReports)).toBe(true);
    expect(dailyReports.length).toBeGreaterThan(0);
    for (const report of dailyReports) {
      expect(report.job).toBeDefined();
      expect(typeof report.durationMs).toBe("number");
    }
  });
});
