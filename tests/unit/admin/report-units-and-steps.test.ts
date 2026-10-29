import { describe, expect, it } from "vitest";
import { mapReportResultToDefinition } from "@/lib/admin/finance-view";
import { mapEntitlementRow } from "@/lib/admin/entitlements-view";
import { inr } from "@/components/admin/format";

describe("report mapper keeps INR minor units (Rs 1 = 100 paise)", () => {
  const result = {
    report: "revenue_by_period",
    columns: [
      { key: "period", label: "Period", kind: "text" },
      { key: "grossMinor", label: "Gross Revenue", kind: "money" },
    ],
    rows: [{ period: "2026-10", grossMinor: 100 }],
    totals: { grossMinor: 100 },
    currency: "INR",
  } as never;

  it("tiles and series stay minor so inr() shows Rs 1.00, not Rs 0.01", () => {
    const def = mapReportResultToDefinition(result, { title: "t", description: "d", formula: "f" });
    expect(def.tiles[0]?.valueInr).toBe(100);
    expect(inr(def.tiles[0]!.valueInr)).toBe("₹1.00");
    expect(def.series[0]?.value).toBe(100);
  });

  it("table cells are formatted money, not raw numbers", () => {
    const def = mapReportResultToDefinition(result, { title: "t", description: "d", formula: "f" });
    expect(def.rows[0]).toEqual(["2026-10", "₹1.00"]);
    expect(def.totals).toEqual(["Total", "₹1.00"]);
  });
});

describe("mapEntitlementRow service steps", () => {
  it("maps doneAt to done flag", () => {
    const row = mapEntitlementRow({
      entitlementId: "e1",
      user: { id: "u", email: "a@b.c", name: null },
      product: { id: "p", name: "P" },
      offering: { id: "o", name: "O" },
      deliveryType: "service",
      status: "active",
      provisioningState: "n/a",
      accessStartsAt: "2026-01-01T00:00:00.000Z",
      accessEndsAt: null,
      downloads: null,
      licenseKeyIssued: false,
      orderNo: "CK-1",
      grantedManuallyBy: null,
      openTasks: 0,
      adminActions: [],
      serviceSteps: [
        { key: "a", title: "A", doneAt: "2026-10-01T00:00:00.000Z", note: null },
        { key: "b", title: "B", doneAt: null, note: null },
      ],
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    expect(row.serviceSteps).toEqual([
      { key: "a", title: "A", done: true },
      { key: "b", title: "B", done: false },
    ]);
  });
});
