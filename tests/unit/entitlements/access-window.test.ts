import { describe, expect, it } from "vitest";
import { calculateAccessEndsAt, isWithinAccessWindow } from "@/modules/entitlements/access";

describe("Entitlements Access Window (D-605, MASTER_SPEC §7)", () => {
  it("computes lifetime access as null", () => {
    const startsAt = new Date("2026-01-15T00:00:00Z");
    expect(calculateAccessEndsAt(startsAt, null)).toBeNull();
    expect(calculateAccessEndsAt(startsAt, undefined)).toBeNull();
    expect(calculateAccessEndsAt(startsAt, 0)).toBeNull();
  });

  it("computes months forward with end-of-month clamping", () => {
    // Normal date
    const d1 = new Date("2026-03-15T00:00:00Z");
    const res1 = calculateAccessEndsAt(d1, 3);
    expect(res1?.toISOString()).toBe(new Date("2026-06-15T00:00:00Z").toISOString());

    // Jan 31 + 1 month clamps to Feb 28
    const d2 = new Date("2026-01-31T00:00:00Z");
    const res2 = calculateAccessEndsAt(d2, 1);
    expect(res2?.toISOString()).toBe(new Date("2026-02-28T00:00:00Z").toISOString());
  });

  it("checks whether current time is within access window", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-06-01T00:00:00Z");

    expect(isWithinAccessWindow(start, end, new Date("2026-03-01T00:00:00Z"))).toBe(true);
    expect(isWithinAccessWindow(start, end, new Date("2026-07-01T00:00:00Z"))).toBe(false);
    expect(isWithinAccessWindow(start, null, new Date("2030-01-01T00:00:00Z"))).toBe(true);
  });
});
