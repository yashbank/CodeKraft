// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildContext } from "@/lib/authz/context";
import { orderAlertText } from "@/modules/orders/alerts-text";
import { newOrdersSince } from "@/modules/orders/alerts";

describe("P14-12a new-order alerts", () => {
  it("toast text names a single order and counts several", () => {
    expect(orderAlertText({ count: 1, latest: [{ id: "i", orderNo: "CK-26-0007" }] })).toBe(
      "New order #CK-26-0007",
    );
    expect(orderAlertText({ count: 3, latest: [] })).toBe("3 new orders");
  });

  it("a caller without orders.read is refused before any query runs", async () => {
    const ctx = buildContext({
      user: { id: "u1" },
      session: { id: "s1" },
      roles: ["customer"],
    });
    await expect(newOrdersSince(ctx as never, new Date())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
