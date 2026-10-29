/**
 * P14-09 — per-widget visual styles: registry shape, backwards-compatible layout parsing, input
 * validation, and the renderer honouring the picked style.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/dashboard",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/modules/dashboard-widgets/admin-mutations", () => ({
  saveDashboardWidgets: vi.fn(async () => ({ ok: true, data: { widgets: [] } })),
  refreshDashboardWidget: vi.fn(),
}));

import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import {
  ADMIN_WIDGET_KEYS,
  parseStoredWidgetEntries,
  parseStoredWidgetLayout,
  saveAdminWidgetLayoutSchema,
  toStoredWidgetLayout,
} from "@/modules/dashboard-widgets/admin-layout";
import {
  WIDGET_KIND,
  WIDGET_STYLES,
  isWidgetStyle,
  resolveWidgetStyle,
} from "@/modules/dashboard-widgets/widget-styles";
import { DASHBOARD } from "@/app/dev/screens/_fixtures/admin";

afterEach(cleanup);

describe("widget style registry", () => {
  it("every kind has 5-6 unique styles and every widget maps to a kind", () => {
    for (const [kind, styles] of Object.entries(WIDGET_STYLES)) {
      expect(styles.length, kind).toBeGreaterThanOrEqual(5);
      expect(styles.length, kind).toBeLessThanOrEqual(6);
      expect(new Set(styles).size, kind).toBe(styles.length);
    }
    expect(Object.keys(WIDGET_KIND).sort()).toEqual([...ADMIN_WIDGET_KEYS].sort());
    for (const kind of Object.values(WIDGET_KIND)) expect(kind in WIDGET_STYLES).toBe(true);
  });

  it("validates a style per widget and falls back to the kind default", () => {
    expect(isWidgetStyle("conversion_rate", "outlined")).toBe(true);
    expect(isWidgetStyle("conversion_rate", "gradient")).toBe(false);
    expect(isWidgetStyle("revenue_by_product", "gradient")).toBe(true);
    expect(resolveWidgetStyle("conversion_rate", "nope")).toBe("plain");
    expect(resolveWidgetStyle("conversion_rate", undefined)).toBe("plain");
    expect(resolveWidgetStyle("conversion_rate", "big-number")).toBe("big-number");
  });
});

describe("layout storage (old + new format)", () => {
  it("reads bare ids, {i} items and {id|i, style} entries", () => {
    const raw = [
      "my_share",
      { i: "new_leads", x: 0, y: 1, w: 12, h: 1 },
      { id: "conversion_rate", style: "outlined" },
      { i: "revenue_by_product", style: "gradient" },
      { id: "new_customers", style: "bogus" },
      "gone",
    ];
    expect(parseStoredWidgetEntries(raw)).toEqual([
      { key: "my_share" },
      { key: "new_leads" },
      { key: "conversion_rate", style: "outlined" },
      { key: "revenue_by_product", style: "gradient" },
      { key: "new_customers" },
    ]);
    expect(parseStoredWidgetLayout(raw)).toEqual([
      "my_share",
      "new_leads",
      "conversion_rate",
      "revenue_by_product",
      "new_customers",
    ]);
    expect(parseStoredWidgetEntries({})).toBeNull();
  });

  it("round-trips styles through the stored shape", () => {
    const entries = [{ key: "conversion_rate", style: "tinted" }, { key: "new_leads" }] as const;
    const stored = toStoredWidgetLayout(entries);
    expect(stored[0]).toMatchObject({ i: "conversion_rate", style: "tinted" });
    expect(stored[1]).not.toHaveProperty("style");
    expect(parseStoredWidgetEntries(stored)).toEqual(entries);
  });

  it("save schema accepts ids and {id, style}, rejects invalid styles", () => {
    const ok = saveAdminWidgetLayoutSchema.safeParse({
      widgets: ["new_leads", { id: "conversion_rate", style: "outlined" }],
    });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.widgets).toEqual([
      { key: "new_leads" },
      { key: "conversion_rate", style: "outlined" },
    ]);
    const bad = (widgets: unknown[]) => saveAdminWidgetLayoutSchema.safeParse({ widgets }).success;
    expect(bad([{ id: "conversion_rate", style: "gradient" }])).toBe(false);
    expect(bad([{ id: "nope", style: "plain" }])).toBe(false);
    expect(bad(["new_leads", { id: "new_leads", style: "plain" }])).toBe(false);
  });
});

describe("renderer", () => {
  const frame = (key: string) => document.querySelector(`section[data-widget="${key}"]`);
  const mount = (styles: Record<string, string>) =>
    render(
      <AdminDashboard
        data={DASHBOARD}
        layout={["conversion_rate", "revenue_by_product", "chatbot_usage"]}
        styles={styles}
        isSuperAdmin
        greeting="Hi"
        dateLabel="d"
      />,
    );

  it("stamps the chosen style on the card and the body renders it", () => {
    mount({
      conversion_rate: "outlined",
      revenue_by_product: "striped",
      chatbot_usage: "segmented",
    });
    expect(frame("conversion_rate")?.getAttribute("data-style")).toBe("outlined");
    expect(frame("revenue_by_product")?.getAttribute("data-style")).toBe("striped");
    expect(frame("revenue_by_product")?.querySelector("pattern")).not.toBeNull();
    expect(frame("chatbot_usage")?.getAttribute("data-style")).toBe("segmented");
  });

  it("an unknown stored style renders the default", () => {
    mount({ conversion_rate: "bogus" });
    expect(frame("conversion_rate")?.getAttribute("data-style")).toBe("plain");
    expect(frame("revenue_by_product")?.getAttribute("data-style")).toBe("filled");
  });
});
