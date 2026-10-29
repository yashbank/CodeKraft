import { describe, expect, it, vi } from "vitest";

import { BULK_MAX, bulkSummary, runBulk } from "@/lib/admin/bulk";

describe("P14-12a bulk actions", () => {
  it("runs the single-item action per id; a forbidden id fails alone", async () => {
    const fn = vi.fn(async (id: string) =>
      id === "b"
        ? { ok: false as const, error: { message: "You don't have permission" } }
        : { ok: true as const },
    );
    const r = await runBulk(["a", "b", "c", "a"], fn);
    expect(fn).toHaveBeenCalledTimes(3); // duplicates collapsed
    expect(r.done).toEqual(["a", "c"]);
    expect(r.failed).toEqual([{ id: "b", message: "You don't have permission" }]);
    expect(bulkSummary("Marked", "order", r)).toBe(
      "Marked 2 of 3 orders; 1 failed: You don't have permission",
    );
  });

  it("a thrown action is a per-id failure, not a crash", async () => {
    const r = await runBulk(["a", "b"], async (id) => {
      if (id === "a") throw new Error("boom");
      return { ok: true };
    });
    expect(r.done).toEqual(["b"]);
    expect(r.failed[0]).toEqual({ id: "a", message: "boom" });
  });

  it("refuses oversized selections before calling anything", async () => {
    const fn = vi.fn();
    const ids = Array.from({ length: BULK_MAX + 1 }, (_, i) => String(i));
    await expect(runBulk(ids, fn)).rejects.toThrow(/at most/);
    expect(fn).not.toHaveBeenCalled();
  });

  it("summary reads cleanly when everything succeeds", () => {
    expect(bulkSummary("Suspended", "customer", { done: ["x"], failed: [] })).toBe(
      "Suspended 1 customer",
    );
  });
});
