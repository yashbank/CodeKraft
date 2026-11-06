/**
 * G18-3c: dashboard widget numbers equal a direct count of the database. The old loaders counted
 * a 100-row page (new leads, catalogue status), so the figures stopped matching past 100 rows.
 * Also pins the empty-database shapes (zeros, never sample data) and the batched refresh slices.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { loadDashboardData } from "@/lib/admin/dashboard-data";
import { loadCatalogStatus } from "@/lib/admin/dashboard-widgets-data";
import { pickWidgetData } from "@/components/admin/dashboard/widget-data-keys";
import { leads } from "../../../drizzle/schema/leads";
import { createAdmin, createSuperAdmin } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const ctxFor = (id: string, role: "super_admin" | "admin" = "super_admin") =>
  buildContext({ user: { id }, session: { id: `s-${id}` }, roles: [role] });

describe("dashboard widgets match the database (G18-3c)", () => {
  const sql = getTestDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll(sql);
  });

  it("empty database: zero values and empty lists, no sample numbers", async () => {
    const sa = await createSuperAdmin();
    const data = await loadDashboardData(ctxFor(sa.id), "30d", [
      "new_leads",
      "overdue_follow_ups",
      "catalog_status",
      "pipeline_funnel",
      "new_customers",
      "orders_heatmap",
    ]);
    expect(data.newLeads.count).toBe(0);
    expect(data.newLeads.items).toEqual([]);
    expect(data.overdueFollowUps).toEqual([]);
    expect(data.catalogStatus).toEqual([]);
    expect(data.funnel.every((s) => s.value === 0)).toBe(true);
    expect(data.ordersHeatmap.total).toBe(0);
  });

  it("new leads count is the exact total even past 100 rows; overdue is counted separately", async () => {
    const sa = await createSuperAdmin();
    await db.insert(leads).values(
      Array.from({ length: 130 }, (_, i) => ({
        source: "inquiry_form",
        name: `Lead ${i}`,
        status: "new",
      })) as never,
    );
    await db.insert(leads).values([
      { source: "inquiry_form", name: "Won", status: "won" },
      {
        source: "inquiry_form",
        name: "Late",
        status: "contacted",
        nextFollowUpAt: new Date(Date.now() - 86_400_000),
      },
    ] as never);

    const data = await loadDashboardData(ctxFor(sa.id), "30d", ["new_leads", "overdue_follow_ups"]);
    const [direct] = await sql`select count(*)::int as c from leads where status = 'new'`;
    expect(data.newLeads.count).toBe(direct?.c);
    expect(data.newLeads.count).toBe(130);
    expect(data.newLeads.items).toHaveLength(5);
    expect(data.overdueFollowUps.map((l) => l.label)).toEqual(["Late"]);
  });

  it("catalogue status is counted in SQL and scoped like the products list", async () => {
    const sa = await createSuperAdmin();
    const owner = await createAdmin();
    for (let i = 0; i < 3; i++) await createProduct({ status: "published", createdBy: owner.id });
    for (let i = 0; i < 2; i++) await createProduct({ status: "draft", createdBy: owner.id });
    await createProduct({ status: "draft", createdBy: sa.id });

    const all = await loadCatalogStatus(ctxFor(sa.id));
    const rows =
      await sql`select status::text as s, count(*)::int as c from products group by status`;
    expect(Object.fromEntries(all.map((r) => [r.status, r.count]))).toEqual(
      Object.fromEntries(rows.map((r) => [r.s, r.c])),
    );

    const mine = await loadCatalogStatus(ctxFor(owner.id, "admin"));
    expect(Object.fromEntries(mine.map((r) => [r.status, r.count]))).toEqual({
      published: 3,
      draft: 2,
    });
  });

  it("the batched refresh slice carries exactly the slices the widgets render", async () => {
    const sa = await createSuperAdmin();
    const data = await loadDashboardData(ctxFor(sa.id), "7d", ["new_leads", "catalog_status"]);
    const merged = {
      ...pickWidgetData("new_leads", data),
      ...pickWidgetData("catalog_status", data),
    };
    expect(Object.keys(merged).sort()).toEqual(["catalogStatus", "newLeads"]);
  });
});
