import { describe, expect, it } from "vitest";

import { bucketWeekdayHour } from "@/modules/dashboard-widgets/heatmap";
import { ADMIN_WIDGET_KEYS } from "@/modules/dashboard-widgets/admin-layout";
import { WIDGET_KIND, WIDGET_STYLES } from "@/modules/dashboard-widgets/widget-styles";
import { allowedWidgetKeys } from "@/components/admin/dashboard/role-widgets";

describe("P14-12a heatmap", () => {
  it("buckets by IST weekday (Mon=0) and hour, ignoring bad dates", () => {
    // 2026-10-26 is a Monday. 03:30Z = 09:00 IST Monday; 20:00Z Sunday = 01:30 IST Monday.
    const h = bucketWeekdayHour([
      "2026-10-26T03:30:00Z",
      "2026-10-26T03:45:00Z",
      "2026-10-25T20:00:00Z",
      "2026-11-01T18:00:00Z", // Sunday 18:00Z = Sunday 23:30 IST
      "not-a-date",
    ]);
    expect(h.total).toBe(4);
    expect(h.grid[0]![9]).toBe(2);
    expect(h.grid[0]![1]).toBe(1);
    expect(h.grid[6]![23]).toBe(1);
    expect(h.max).toBe(2);
    expect(h.grid.flat().reduce((a, b) => a + b, 0)).toBe(h.total);
  });

  it("is a registered heatmap widget with 5-6 styles, super admin only", () => {
    expect(ADMIN_WIDGET_KEYS).toContain("orders_heatmap");
    expect(WIDGET_KIND.orders_heatmap).toBe("heatmap");
    expect(WIDGET_STYLES.heatmap.length).toBeGreaterThanOrEqual(5);
    expect(WIDGET_STYLES.heatmap.length).toBeLessThanOrEqual(6);
    expect(allowedWidgetKeys(["super_admin"])).toContain("orders_heatmap");
    expect(allowedWidgetKeys(["admin"])).not.toContain("orders_heatmap");
    expect(allowedWidgetKeys(["staff"])).not.toContain("orders_heatmap");
  });
});
