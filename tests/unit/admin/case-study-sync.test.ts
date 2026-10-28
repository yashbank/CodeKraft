import { describe, expect, it } from "vitest";
import { resolveEditing } from "@/components/admin/content/case-study-sync";

const rows = [
  { id: "a", slug: "one", status: "published" },
  { id: "b", slug: "two", status: "draft" },
];

describe("resolveEditing", () => {
  it("refreshes the open row (status changes after publish)", () => {
    expect(resolveEditing(rows, { id: "a" }, null)).toBe(rows[0]);
  });
  it("selects a newly created row by its saved slug", () => {
    expect(resolveEditing(rows, null, "two")).toBe(rows[1]);
  });
  it("returns null when deleted or nothing saved", () => {
    expect(resolveEditing(rows, { id: "zzz" }, null)).toBeNull();
    expect(resolveEditing(rows, null, null)).toBeNull();
  });
});
