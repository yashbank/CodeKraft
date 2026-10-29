import { describe, expect, it } from "vitest";

import { moveKey } from "@/components/admin/dashboard/reorder";
import {
  parseStoredWidgetEntries,
  toStoredWidgetLayout,
  type AdminWidgetKey,
} from "@/modules/dashboard-widgets/admin-layout";

describe("P14-12a dashboard reorder", () => {
  it("moves a widget onto another's slot, either direction", () => {
    expect(moveKey(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(moveKey(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moveKey(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(moveKey(["a", "b"], "a", "zzz")).toEqual(["a", "b"]);
  });

  it("persisted order keeps the {i, style} entry format and round-trips", () => {
    const start: AdminWidgetKey[] = ["new_leads", "conversion_rate", "open_queries"];
    const order = moveKey(start, "open_queries", "new_leads");
    const stored = toStoredWidgetLayout(
      order.map((key) => (key === "conversion_rate" ? { key, style: "outlined" } : { key })),
    );
    expect(stored.map((s) => s.i)).toEqual(["open_queries", "new_leads", "conversion_rate"]);
    expect(stored.map((s) => s.y)).toEqual([0, 1, 2]);
    expect(stored[2]).toMatchObject({ i: "conversion_rate", style: "outlined" });
    expect(parseStoredWidgetEntries(stored)).toEqual([
      { key: "open_queries" },
      { key: "new_leads" },
      { key: "conversion_rate", style: "outlined" },
    ]);
  });
});
