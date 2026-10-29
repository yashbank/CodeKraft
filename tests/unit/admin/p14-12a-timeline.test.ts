import { describe, expect, it } from "vitest";

import { humanizeAction } from "@/modules/audit/humanize";
import { mapCustomerDetail } from "@/lib/admin/customers-view";

describe("P14-12a activity timeline", () => {
  it("turns audit action codes into readable text", () => {
    expect(humanizeAction("API-ADM-08 customer.suspend")).toBe("Customer suspend");
    expect(humanizeAction("order.status_changed")).toBe("Order status changed");
    expect(humanizeAction("")).toBe("");
  });

  it("customer activity carries the event kind so audit events and orders are told apart", () => {
    const detail = {
      user: { id: "u1", name: "Asha", email: "a@x.in", createdAt: new Date(), status: "active" },
      profile: null,
      stats: { orders: 0, spentInrMinor: 0, entitlements: 0 },
      lastOrderAt: null,
      internalNotes: null,
      timeline: [
        { at: "2026-10-01T10:00:00.000Z", kind: "audit", summary: "Customer suspend" },
        { at: "2026-09-01T10:00:00.000Z", kind: "order", summary: "Order CK-1 placed" },
      ],
    };
    const out = mapCustomerDetail(
      detail as never,
      [],
      (() => ({})) as never,
      "2026-10-30T00:00:00Z",
    );
    expect(out.activity.map((a) => a.kind)).toEqual(["admin", "customer"]);
  });
});
