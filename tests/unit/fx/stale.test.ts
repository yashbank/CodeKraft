import { describe, expect, it } from "vitest";
import { isRateStale } from "@/modules/fx/client";

describe("FX Staleness Detection (FR-FIN-13, docs/06 §3.3, PHASE-03 P3.12)", () => {
  const fixedNow = new Date("2026-09-26T12:00:00Z");

  it("is not stale within the 3-day window", () => {
    expect(isRateStale("2026-09-26", fixedNow)).toBe(false); // same day (0 days)
    expect(isRateStale("2026-09-25", fixedNow)).toBe(false); // 1 day ago
    expect(isRateStale("2026-09-24", fixedNow)).toBe(false); // 2 days ago
    expect(isRateStale("2026-09-23", fixedNow)).toBe(false); // 3 days ago
  });

  it("is flagged stale when rate is older than 3 days", () => {
    expect(isRateStale("2026-09-22", fixedNow)).toBe(true); // 4 days ago (> 3 days)
    expect(isRateStale("2026-09-20", fixedNow)).toBe(true); // 6 days ago
    expect(isRateStale("2026-08-01", fixedNow)).toBe(true); // almost 2 months ago
  });

  it("treats malformed or missing date as stale for safety", () => {
    expect(isRateStale("", fixedNow)).toBe(true);
    expect(isRateStale("invalid-date", fixedNow)).toBe(true);
  });
});
