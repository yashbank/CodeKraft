import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, WIDGET_LIBRARY } from "@/components/admin/dashboard/widget-library";
import {
  ADMIN_WIDGET_KEYS,
  parseStoredWidgetLayout,
  saveAdminWidgetLayoutSchema,
  toStoredWidgetLayout,
} from "@/modules/dashboard-widgets/admin-layout";

describe("dashboard admin widget layout (R8-10)", () => {
  it("persisted key list matches the UI widget library exactly", () => {
    expect([...ADMIN_WIDGET_KEYS].sort()).toEqual(WIDGET_LIBRARY.map((w) => w.key).sort());
    for (const k of DEFAULT_LAYOUT) expect(ADMIN_WIDGET_KEYS).toContain(k);
  });

  it("round-trips order through the stored item shape", () => {
    const keys = ["system_health", "new_leads", "revenue_by_period"] as const;
    expect(parseStoredWidgetLayout(toStoredWidgetLayout(keys))).toEqual([...keys]);
  });

  it("drops unknown + duplicate keys and accepts bare string arrays", () => {
    expect(parseStoredWidgetLayout(["new_leads", "gone_widget", { i: "new_leads" }, 3])).toEqual([
      "new_leads",
    ]);
    expect(parseStoredWidgetLayout({})).toBeNull();
    expect(parseStoredWidgetLayout([])).toEqual([]);
  });

  it("validates input: unknown or duplicate keys are rejected", () => {
    expect(saveAdminWidgetLayoutSchema.safeParse({ widgets: ["new_leads"] }).success).toBe(true);
    expect(saveAdminWidgetLayoutSchema.safeParse({ widgets: ["x"] }).success).toBe(false);
    expect(
      saveAdminWidgetLayoutSchema.safeParse({ widgets: ["new_leads", "new_leads"] }).success,
    ).toBe(false);
  });
});
