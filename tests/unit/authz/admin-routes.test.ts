import { describe, expect, it } from "vitest";

import { canOpenAdminRoute, filterAdminNav } from "@/lib/authz/admin-routes";
import { ADMIN_NAV } from "@/components/admin/AdminShell";

const DENIED = [
  "/admin/finance/ledger",
  "/admin/finance/expenses",
  "/admin/finance/adjustments",
  "/admin/finance/partners",
  "/admin/finance/allocations",
  "/admin/admin-users",
  "/admin/audit",
];

describe("admin route guard", () => {
  it.each(DENIED)("%s: staff denied, admin and super_admin allowed", (p) => {
    expect(canOpenAdminRoute(["staff"], p)).toBe(false);
    expect(canOpenAdminRoute(["admin"], p)).toBe(true);
    expect(canOpenAdminRoute(["super_admin"], p)).toBe(true);
  });

  it("staff keeps its allowed pages", () => {
    for (const p of [
      "/admin/dashboard",
      "/admin/orders",
      "/admin/finance/reports",
      "/admin/settings",
    ])
      expect(canOpenAdminRoute(["staff"], p)).toBe(true);
  });

  it("nav hides finance, admin-users and audit for staff only", () => {
    const routes = (r: "staff" | "admin") =>
      filterAdminNav(ADMIN_NAV, [r]).flatMap((g) =>
        g.items.flatMap((i) => ("children" in i ? i.children.map((c) => c.route) : [i.route])),
      );
    const staff = routes("staff");
    for (const r of ["/finance/ledger", "/finance/expenses", "/admin-users", "/audit"])
      expect(staff).not.toContain(r);
    expect(routes("admin")).toEqual(
      expect.arrayContaining(["/finance/ledger", "/admin-users", "/audit"]),
    );
  });
});
