import { describe, expect, it } from "vitest";
import { computeFy } from "@/modules/invoices/numbering";

describe("Financial Year (FY) numbering unit tests (BR-16, FI-09)", () => {
  it("computes FY 2026-27 for dates from 1 Apr 2026 to 31 Mar 2027 in Asia/Kolkata", () => {
    // 1 Apr 2026 00:00:00 IST is 2026-03-31T18:30:00.000Z
    const startOfFy = new Date("2026-03-31T18:30:00.000Z");
    expect(computeFy(startOfFy)).toBe("2026-27");

    const midFy = new Date("2026-10-15T10:00:00.000Z");
    expect(computeFy(midFy)).toBe("2026-27");

    // 31 Mar 2027 23:59:59 IST is 2027-03-31T18:29:59.000Z
    const endOfFy = new Date("2027-03-31T18:29:59.000Z");
    expect(computeFy(endOfFy)).toBe("2026-27");
  });

  it("computes FY 2025-26 for 31 Mar 2026 23:59:59 IST", () => {
    const endOfPrevFy = new Date("2026-03-31T18:29:59.000Z");
    expect(computeFy(endOfPrevFy)).toBe("2025-26");
  });

  it("computes FY 2027-28 for 1 Apr 2027 00:00:00 IST", () => {
    const startOfNextFy = new Date("2027-03-31T18:30:00.000Z");
    expect(computeFy(startOfNextFy)).toBe("2027-28");
  });
});
