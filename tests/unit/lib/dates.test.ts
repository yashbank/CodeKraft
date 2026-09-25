import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  endOfFy,
  fyFor,
  fyLabel,
  fyStartYear,
  isoDate,
  isoTimestamp,
  istParts,
  nowIst,
  startOfFy,
  toDate,
} from "@/lib/dates";

describe("fyFor (Asia/Kolkata financial year)", () => {
  it("switches at 1 April 00:00 IST (18:30 UTC on 31 March)", () => {
    expect(fyFor("2027-03-31T18:29:59Z")).toBe("2026-27");
    expect(fyFor("2027-03-31T18:30:00Z")).toBe("2027-28");
    expect(fyFor("2026-03-31T18:29:59.999Z")).toBe("2025-26");
    expect(fyFor("2026-03-31T18:30:00.000Z")).toBe("2026-27");
  });

  it("handles the 31 Dec / 1 Jan boundary and Date / epoch inputs", () => {
    expect(fyFor("2026-12-31T23:59:59Z")).toBe("2026-27");
    expect(fyFor("2027-01-01T00:00:00Z")).toBe("2026-27");
    expect(fyFor(new Date("2026-09-25T12:00:00Z"))).toBe("2026-27");
    expect(fyFor(Date.UTC(2026, 3, 1))).toBe("2026-27");
    expect(fyFor(Date.UTC(2099, 3, 1))).toBe("2099-00");
  });

  it("rejects invalid dates", () => {
    expect(() => fyFor("not a date")).toThrow(/invalid date/);
    expect(() => toDate(Number.NaN)).toThrow(RangeError);
  });
});

describe("fyLabel / fyStartYear", () => {
  it("round-trips labels", () => {
    expect(fyLabel(2026)).toBe("2026-27");
    expect(fyLabel(2099)).toBe("2099-00");
    expect(fyStartYear("2026-27")).toBe(2026);
    expect(fyStartYear("2099-00")).toBe(2099);
    expect(() => fyLabel(2026.5)).toThrow(RangeError);
    expect(() => fyStartYear("2026-28")).toThrow(/inconsistent/);
    expect(() => fyStartYear("26-27")).toThrow(/must look like/);
  });
});

describe("startOfFy / endOfFy", () => {
  it("returns 1 April 00:00 IST as an instant", () => {
    expect(startOfFy("2026-27").toISOString()).toBe("2026-03-31T18:30:00.000Z");
    expect(startOfFy("2027-03-31T18:29:59Z").toISOString()).toBe("2026-03-31T18:30:00.000Z");
    expect(startOfFy("2027-03-31T18:30:00Z").toISOString()).toBe("2027-03-31T18:30:00.000Z");
    expect(startOfFy(new Date("2026-09-25T00:00:00Z")).toISOString()).toBe(
      "2026-03-31T18:30:00.000Z",
    );
    expect(endOfFy("2026-27").toISOString()).toBe("2027-03-31T18:30:00.000Z");
    expect(endOfFy("2026-09-25T00:00:00Z").getTime()).toBe(startOfFy("2027-28").getTime());
  });
});

describe("istParts / isoDate / isoTimestamp", () => {
  it("shifts by +05:30", () => {
    const p = istParts("2026-03-31T18:30:00Z");
    expect(p).toEqual({
      year: 2026,
      month: 4,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      isoDate: "2026-04-01",
    });
    expect(isoDate("2026-03-31T18:30:00Z")).toBe("2026-04-01");
    expect(isoDate("2026-03-31T18:30:00Z", "UTC")).toBe("2026-03-31");
    expect(isoTimestamp("2026-03-31T18:30:00Z")).toBe("2026-03-31T18:30:00.000Z");
    expect(isoTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(nowIst().isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("addMonths / addDays", () => {
  it("clamps to the end of the target month", () => {
    expect(addMonths("2026-01-31T10:00:00Z", 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonths("2028-01-31T00:00:00Z", 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(addMonths("2026-03-31T00:00:00Z", -1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonths("2026-05-31T00:00:00Z", 1).toISOString()).toBe("2026-06-30T00:00:00.000Z");
    expect(addMonths("2026-11-15T00:00:00Z", 3).toISOString()).toBe("2027-02-15T00:00:00.000Z");
    expect(addMonths("2026-01-15T00:00:00Z", 12).toISOString()).toBe("2027-01-15T00:00:00.000Z");
    expect(addMonths("2026-01-15T00:00:00Z", 0).toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(() => addMonths("2026-01-15T00:00:00Z", 1.5)).toThrow(RangeError);
  });

  it("adds whole days", () => {
    expect(addDays("2026-02-28T00:00:00Z", 1).toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(addDays("2026-01-01T00:00:00Z", -1).toISOString()).toBe("2025-12-31T00:00:00.000Z");
    expect(() => addDays("2026-01-01T00:00:00Z", 0.5)).toThrow(RangeError);
  });

  it("does not mutate the input date", () => {
    const d = new Date("2026-01-31T00:00:00Z");
    addMonths(d, 1);
    addDays(d, 1);
    expect(d.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
});
