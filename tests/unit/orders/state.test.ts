import { describe, expect, it } from "vitest";
import { assertCanTransitionOrder, canTransitionOrder } from "@/modules/orders/state";
import { AppError, ErrorCode } from "@/lib/errors";

describe("orders state machine transitions (docs/03 §3.1)", () => {
  it("allows valid forward transitions", () => {
    expect(canTransitionOrder("pending_payment", "paid")).toBe(true);
    expect(canTransitionOrder("pending_payment", "cancelled")).toBe(true);
    expect(canTransitionOrder("pending_payment", "failed")).toBe(true);

    expect(canTransitionOrder("paid", "fulfilled")).toBe(true);
    expect(canTransitionOrder("paid", "partially_refunded")).toBe(true);
    expect(canTransitionOrder("paid", "refunded")).toBe(true);

    expect(canTransitionOrder("fulfilled", "partially_refunded")).toBe(true);
    expect(canTransitionOrder("fulfilled", "refunded")).toBe(true);

    expect(canTransitionOrder("partially_refunded", "refunded")).toBe(true);
  });

  it("disallows illegal transitions", () => {
    // Cannot go backwards from terminal/advanced states
    expect(canTransitionOrder("cancelled", "paid")).toBe(false);
    expect(canTransitionOrder("failed", "paid")).toBe(false);
    expect(canTransitionOrder("refunded", "paid")).toBe(false);
    expect(canTransitionOrder("fulfilled", "pending_payment")).toBe(false);
    expect(canTransitionOrder("paid", "pending_payment")).toBe(false);
  });

  it("assertCanTransitionOrder throws AppError(STATE_INVALID) on forbidden transition", () => {
    expect(() => assertCanTransitionOrder("cancelled", "paid")).toThrow(AppError);
    try {
      assertCanTransitionOrder("cancelled", "paid");
    } catch (err: any) {
      expect(err.code).toBe(ErrorCode.STATE_INVALID);
    }
  });

  it("assertCanTransitionOrder succeeds silently on allowed transition", () => {
    expect(() => assertCanTransitionOrder("pending_payment", "paid")).not.toThrow();
  });
});
