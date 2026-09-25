import { describe, expect, it } from "vitest";
import { buildDiff } from "@/modules/audit/diff";

describe("audit buildDiff (docs/06 §1.6, PHASE-03 P3.1)", () => {
  it("returns null when before and after are identical", () => {
    expect(buildDiff({ a: 1, b: "test" }, { a: 1, b: "test" })).toBeNull();
    expect(buildDiff("same", "same")).toBeNull();
    expect(buildDiff(123, 123)).toBeNull();
    expect(buildDiff(undefined, undefined)).toBeNull();
  });

  it("extracts only the changed keys between two objects", () => {
    const before = { id: "123", name: "Old", price: 100, active: true };
    const after = { id: "123", name: "New", price: 100, active: false };

    const diff = buildDiff(before, after);
    expect(diff).toEqual({
      before: { name: "Old", active: true },
      after: { name: "New", active: false },
    });
  });

  it("handles keys added or removed", () => {
    const before = { a: 1, b: 2 };
    const after = { b: 2, c: 3 };

    const diff = buildDiff(before, after);
    expect(diff).toEqual({
      before: { a: 1 },
      after: { c: 3 },
    });
  });

  it("handles null or primitive transitions", () => {
    expect(buildDiff(null, { created: true })).toEqual({
      before: null,
      after: { created: true },
    });

    expect(buildDiff({ deleted: true }, null)).toEqual({
      before: { deleted: true },
      after: null,
    });

    expect(buildDiff("draft", "published")).toEqual({
      before: "draft",
      after: "published",
    });
  });
});
