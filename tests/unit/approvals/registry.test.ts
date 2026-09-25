import { describe, expect, it } from "vitest";
import { InMemoryApplyHandlerRegistry } from "@/modules/approvals/registry";

describe("approvals InMemoryApplyHandlerRegistry (PHASE-03 P3.2)", () => {
  it("registers and retrieves apply handlers for approval types", () => {
    const registry = new InMemoryApplyHandlerRegistry();
    const mockHandler = async () => {};

    registry.registerApplyHandler("product.publish", mockHandler);
    expect(registry.getApplyHandler("product.publish")).toBe(mockHandler);
    expect(registry.getApplyHandler("refund.issue")).toBeUndefined();
  });

  it("registers and retrieves reject handlers for approval types", () => {
    const registry = new InMemoryApplyHandlerRegistry();
    const mockRejectHandler = async () => {};

    registry.registerRejectHandler("ownership.change", mockRejectHandler);
    expect(registry.getRejectHandler("ownership.change")).toBe(mockRejectHandler);
    expect(registry.getRejectHandler("product.publish")).toBeUndefined();
  });

  it("clears all registered handlers", () => {
    const registry = new InMemoryApplyHandlerRegistry();
    registry.registerApplyHandler("ledger.adjustment", async () => {});
    registry.registerRejectHandler("ledger.adjustment", async () => {});

    registry.clear();
    expect(registry.getApplyHandler("ledger.adjustment")).toBeUndefined();
    expect(registry.getRejectHandler("ledger.adjustment")).toBeUndefined();
  });
});
