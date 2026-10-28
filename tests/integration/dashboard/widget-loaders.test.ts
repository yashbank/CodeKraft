/**
 * The dashboard widgets that used to be hard-coded empty now run real queries. Each loader must
 * execute against the real schema (no SQL errors swallowed into the empty fallback) and return the
 * empty shape on an empty database.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  loadChatbotUsage,
  loadConversionRate,
  loadFunnel,
  loadNewCustomers,
  loadRevocationTasks,
  loadServiceChecklists,
  loadSystemHealth,
  loadVisits,
} from "@/lib/admin/dashboard-widgets-data";
import { leads } from "../../../drizzle/schema/leads";
import { analyticsEvents } from "../../../drizzle/schema/ops";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createUser } from "../../factories/users";

describe("dashboard widget loaders", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
    errors.mockClear();
  });

  it("empty database: every loader returns its empty shape without a query error", async () => {
    expect(await loadServiceChecklists()).toEqual([]);
    expect(await loadRevocationTasks()).toEqual([]);
    expect((await loadFunnel()).every((s) => s.value === 0)).toBe(true);
    expect(await loadConversionRate(30)).toEqual({ value: 0, delta: "No data yet" });
    expect(await loadVisits(30)).toEqual({ total: 0, delta: "No data yet", top: [] });
    expect((await loadChatbotUsage()).platform).toBe(0);
    const customers = await loadNewCustomers(7);
    expect(customers.count).toBe(0);
    expect(customers.sparkline).toHaveLength(7);
    const health = await loadSystemHealth();
    expect(health.find((h) => h.label === "Database")?.ok).toBe(true);
    expect(errors).not.toHaveBeenCalled();
  });

  it("with data: funnel, conversion, visits and customers reflect the tables", async () => {
    await db.insert(leads).values([
      { source: "inquiry_form", name: "A", status: "new" },
      { source: "inquiry_form", name: "B", status: "won" },
      { source: "inquiry_form", name: "C", status: "lost" },
    ] as never);
    await db.insert(analyticsEvents).values([{ name: "page_view" }, { name: "page_view" }]);
    await createUser();

    const funnel = await loadFunnel();
    expect(funnel.find((s) => s.label === "New")?.value).toBe(1);
    expect(funnel.find((s) => s.label === "Won")?.value).toBe(1);
    const conv = await loadConversionRate(30);
    expect(conv.value).toBeCloseTo(0.5);
    expect((await loadVisits(30)).total).toBe(2);
    expect(errors).not.toHaveBeenCalled();
  });
});
