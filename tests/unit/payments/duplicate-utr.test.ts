import { describe, expect, it } from "vitest";
import { findDuplicateUtrWarnings, isDuplicateUtr } from "@/modules/payments/duplicate";

describe("Duplicate UTR checks unit tests (TM-01)", () => {
  it("detects exact duplicate reference case-insensitively", () => {
    const existing = ["UTR123456", "UTR999999"];
    expect(isDuplicateUtr("utr123456", existing)).toBe(true);
    expect(isDuplicateUtr(" UTR123456 ", existing)).toBe(true);
    expect(isDuplicateUtr("UTR000000", existing)).toBe(false);
  });

  it("handles null and empty references gracefully", () => {
    expect(isDuplicateUtr(null, ["UTR123"])).toBe(false);
    expect(isDuplicateUtr("", ["UTR123"])).toBe(false);
    expect(isDuplicateUtr("UTR123", [null, undefined, ""])).toBe(false);
  });

  it("produces warnings map for duplicate payments in admin read model", () => {
    const payments = [
      { id: "p1", customerReference: "UTR-ABC" },
      { id: "p2", customerReference: "UTR-XYZ" },
      { id: "p3", customerReference: "utr-abc" },
    ];

    const warnings = findDuplicateUtrWarnings(payments);
    expect(warnings.has("p1")).toBe(true);
    expect(warnings.has("p3")).toBe(true);
    expect(warnings.has("p2")).toBe(false);
    expect(warnings.get("p1")![0]).toContain("shared with 1 other payment");
  });
});
