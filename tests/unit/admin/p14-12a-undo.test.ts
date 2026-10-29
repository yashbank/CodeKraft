// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { success, error } = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success, error } }));

import { UNDO_MS, undoToast } from "@/lib/admin/undo";
import { deleteView, listViews, restoreView, saveView } from "@/lib/admin/saved-views";
import { deactivateCouponInput } from "@/modules/coupons/types";

function memStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe("P14-12a undo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("undoToast shows a ~6s Undo action that runs the undo and confirms", async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    undoToast("Deleted", undo, "Back");
    const [msg, opts] = success.mock.calls[0]!;
    expect(msg).toBe("Deleted");
    expect(opts.duration).toBe(UNDO_MS);
    expect(UNDO_MS).toBeGreaterThanOrEqual(5000);
    expect(opts.action.label).toBe("Undo");
    opts.action.onClick();
    await Promise.resolve();
    await Promise.resolve();
    expect(undo).toHaveBeenCalledOnce();
    expect(success).toHaveBeenLastCalledWith("Back");
  });

  it("undoToast surfaces the undo error instead of success", async () => {
    undoToast("Deleted", () => "nope");
    success.mock.calls[0]![1].action.onClick();
    await Promise.resolve();
    await Promise.resolve();
    expect(error).toHaveBeenCalledWith("nope");
  });

  it("saved view delete is undoable and restoreView is idempotent", () => {
    const s = memStore();
    const [v] = saveView(s, "u1", "orders", "Pending", "status=pending");
    deleteView(s, "u1", "orders", v!.id);
    expect(listViews(s, "u1", "orders")).toEqual([]);
    expect(restoreView(s, "u1", "orders", v!)).toEqual([v]);
    expect(restoreView(s, "u1", "orders", v!)).toEqual([v]);
  });

  it("deactivateCoupon accepts undo:true only", () => {
    const id = "6f1c1f0e-8f7a-4c0e-9c3e-2f6f1d5b7a11";
    expect(deactivateCouponInput.safeParse({ id, undo: true }).success).toBe(true);
    expect(deactivateCouponInput.safeParse({ id, undo: false }).success).toBe(false);
  });
});
