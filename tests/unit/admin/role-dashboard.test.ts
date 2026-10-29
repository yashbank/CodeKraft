import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildContext } from "@/lib/authz/context";

const listApprovals = vi.fn();
const listLeads = vi.fn();
const listQueries = vi.fn();
const listProducts = vi.fn();
const getReport = vi.fn();
const loadFinance = vi.fn();
const none = vi.hoisted(() => async () => []);

vi.mock("@/modules/approvals/queries", () => ({
  listApprovalsAction: (...a: unknown[]) => listApprovals(...a),
}));
vi.mock("@/modules/leads/queries", () => ({
  listLeadsQuery: (...a: unknown[]) => listLeads(...a),
}));
vi.mock("@/modules/queries/queries", () => ({
  listQueriesAdminQuery: (...a: unknown[]) => listQueries(...a),
}));
vi.mock("@/modules/catalog/queries", () => ({
  listProductsAdminQuery: (...a: unknown[]) => listProducts(...a),
}));
vi.mock("@/modules/finance/queries", () => ({
  getReportQuery: (...a: unknown[]) => getReport(...a),
}));
vi.mock("@/lib/admin/dashboard-finance", () => ({
  loadDashboardFinance: (...a: unknown[]) => loadFinance(...a),
}));
vi.mock("@/lib/admin/dashboard-widgets-data", () => ({
  RANGE_DAYS: { "7d": 7, "30d": 30, "90d": 90, fy: 366 },
  deltaText: () => "",
  loadChatbotUsage: none,
  loadConversionRate: none,
  loadFunnel: none,
  loadNewCustomers: none,
  loadRevocationTasks: none,
  loadServiceChecklists: none,
  loadSystemHealth: none,
  loadVisits: none,
}));

import {
  allowedWidgetKeys,
  defaultLayoutFor,
  permitWidgets,
} from "@/components/admin/dashboard/role-widgets";
import { loadDashboardData } from "@/lib/admin/dashboard-data";

const ctx = (role: "super_admin" | "admin" | "staff") =>
  buildContext({ user: { id: "u1" }, session: { id: "s1" }, roles: [role], partnerId: "p1" });
const empty = { ok: true, data: { items: [] } };

beforeEach(() => {
  vi.clearAllMocks();
  for (const f of [listApprovals, listLeads, listQueries, listProducts]) f.mockResolvedValue(empty);
  getReport.mockResolvedValue({ ok: true, data: { rows: [] } });
  loadFinance.mockResolvedValue(null);
});

describe("role widget allow-list (P14-01)", () => {
  it("super_admin gets every widget", () => {
    expect(allowedWidgetKeys(["super_admin"]).length).toBe(22);
  });
  it("admin and staff get small, scoped sets", () => {
    const admin = allowedWidgetKeys(["admin"]);
    expect(admin).toEqual(
      expect.arrayContaining(["my_share", "publish_approvals", "open_queries", "new_leads"]),
    );
    expect(admin).not.toContain("revenue_by_partner");
    expect(admin).not.toContain("system_health");
    expect(admin).not.toContain("payments_awaiting");
    expect([...allowedWidgetKeys(["staff"])].sort()).toEqual(
      ["new_leads", "open_queries", "overdue_follow_ups", "service_checklists"].sort(),
    );
    expect(allowedWidgetKeys(["customer"])).toEqual([]);
  });
  it("drops disallowed ids from a saved layout and keeps order", () => {
    expect(
      permitWidgets(["system_health", "new_leads", "revenue_by_partner", "my_share"], ["admin"]),
    ).toEqual(["new_leads", "my_share"]);
    expect(permitWidgets(["system_health", "my_share"], ["super_admin"])).toEqual([
      "system_health",
      "my_share",
    ]);
  });
  it("default layout is within the role's allow-list", () => {
    for (const r of ["super_admin", "admin", "staff"] as const) {
      const allowed = allowedWidgetKeys([r]);
      const def = defaultLayoutFor(allowed);
      expect(def.length).toBeGreaterThan(0);
      for (const k of def) expect(allowed).toContain(k);
    }
  });
});

describe("loadDashboardData scoping (P14-01)", () => {
  it("does not fetch data for widgets outside the requested set", async () => {
    await loadDashboardData(ctx("super_admin"), "30d", ["open_queries"]);
    expect(listQueries).toHaveBeenCalledTimes(1);
    expect(listLeads).not.toHaveBeenCalled();
    expect(listProducts).not.toHaveBeenCalled();
    expect(listApprovals).not.toHaveBeenCalled();
    expect(getReport).not.toHaveBeenCalled();
    expect(loadFinance).not.toHaveBeenCalled();
  });
  it("does not fetch a widget the role may not have, even if requested", async () => {
    await loadDashboardData(ctx("staff"), "30d", ["revenue_by_period", "my_share", "new_leads"]);
    expect(getReport).not.toHaveBeenCalled();
    expect(loadFinance).not.toHaveBeenCalled();
    expect(listLeads).toHaveBeenCalledTimes(1);
  });
  it("publish approvals are only the requests the caller must decide on", async () => {
    await loadDashboardData(ctx("admin"), "30d", ["publish_approvals"]);
    expect(listApprovals).toHaveBeenCalledTimes(1);
    expect(listApprovals.mock.calls[0]?.[0]).toMatchObject({
      limit: 10,
      filters: { type: "product.publish", mine: true },
    });
  });
});
