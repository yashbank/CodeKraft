import { describe, expect, it, vi } from "vitest";
import { nextOrderNo } from "@/modules/orders/numbering";

describe("order numbering sequence generator (BR-16, docs/06 §2.3)", () => {
  it("formats order numbers using CK-ORD-nnnnnn format", async () => {
    const mockTx = {
      execute: vi.fn().mockResolvedValue([{ order_no: "CK-ORD-000042" }]),
    };

    const orderNo = await nextOrderNo(mockTx as any);
    expect(orderNo).toBe("CK-ORD-000042");
    expect(mockTx.execute).toHaveBeenCalled();
  });

  it("handles result with rows array", async () => {
    const mockTx = {
      execute: vi.fn().mockResolvedValue({ rows: [{ order_no: "CK-ORD-123456" }] }),
    };

    const orderNo = await nextOrderNo(mockTx as any);
    expect(orderNo).toBe("CK-ORD-123456");
  });

  it("throws error when sequence row is empty", async () => {
    const mockTx = {
      execute: vi.fn().mockResolvedValue([]),
    };

    await expect(nextOrderNo(mockTx as any)).rejects.toThrow(
      "Failed to generate order number from sequence order_no_seq",
    );
  });
});
