import { describe, expect, it } from "vitest";
import {
  groupPreview,
  orphanPartner,
  resetTableLabel,
  stepsFor,
} from "@/modules/settings/site-reset-plan";

describe("site reset preview grouping", () => {
  it("groups counts under their category with a total and plain names", () => {
    const groups = groupPreview([
      { table: "ledger_entries", count: 4 },
      { table: "payouts", count: 1 },
      { table: "partners", count: 2 },
      { table: "orders", count: 3 },
    ]);
    expect(groups.map((g) => [g.category, g.total])).toEqual([
      ["customers_orders", 5],
      ["finance", 5],
    ]);
    expect(resetTableLabel("payouts")).toBe("Payouts");
    expect(resetTableLabel("some_other_table")).toBe("some other table");
  });

  it("customers_orders also deletes ownership versions held by orphan partners, before partners", () => {
    const tables = stepsFor(["customers_orders"]).map((s) => s.table);
    expect(tables.indexOf("product_ownerships")).toBeGreaterThan(tables.indexOf("orders"));
    expect(tables.indexOf("product_ownerships")).toBeLessThan(tables.indexOf("partners"));
    expect(orphanPartner('"x"."partner_id"')).toContain("NOT EXISTS");
  });
});
