/**
 * docs/06 §1.2 encoded row by row. Cells: "●" granted, "◐" granted with admin scope, "-" absent.
 * Column order: super_admin, admin, staff, customer. This is the drift tripwire (P1.6 risk note).
 */
import { describe, expect, it } from "vitest";
import {
  ADMIN_CLASS_ROLES,
  ADMIN_SCOPED_PERMISSIONS,
  ADMIN_SCOPES,
  PERMISSIONS,
  type Permission,
  ROLE_PERMISSIONS,
  ROLES,
  type Role,
  isPermission,
  isRole,
  permissionsForRoles,
} from "@/lib/authz/permissions";

type Cell = "●" | "◐" | "-";
type Row = [Permission, Cell, Cell, Cell, Cell];

const MATRIX: readonly Row[] = [
  // Self
  ["account.self", "●", "●", "●", "●"],
  ["commerce.self", "-", "-", "-", "●"],
  ["delivery.self", "-", "-", "-", "●"],
  ["support.self", "-", "-", "-", "●"],
  ["chat.use", "-", "-", "-", "●"],
  // Catalog
  ["catalog.read", "●", "●", "●", "-"],
  ["catalog.write", "●", "◐", "●", "-"],
  ["catalog.submit", "●", "◐", "-", "-"],
  ["catalog.lifecycle.request", "●", "◐", "-", "-"],
  ["ownership.propose", "●", "◐", "-", "-"],
  // Content
  ["content.read", "●", "●", "●", "-"],
  ["content.write", "●", "●", "●", "-"],
  ["content.publish", "●", "●", "-", "-"],
  // Commerce
  ["orders.read", "●", "◐", "●", "-"],
  ["orders.manual.write", "●", "●", "-", "-"],
  // Payments
  ["payments.confirm", "●", "●", "-", "-"],
  ["refunds.propose", "●", "●", "-", "-"],
  // Invoices
  ["invoices.issue", "●", "◐", "●", "-"],
  ["invoices.read", "●", "◐", "●", "-"],
  // Delivery
  ["delivery.tasks.write", "●", "◐", "●", "-"],
  ["entitlements.admin", "●", "◐", "-", "-"],
  // Finance
  ["finance.ledger.read", "●", "◐", "-", "-"],
  ["finance.ledger.read_all", "●", "-", "-", "-"],
  ["finance.payout.record", "●", "●", "-", "-"],
  ["finance.expense.write", "●", "●", "-", "-"],
  ["finance.adjustment.propose", "●", "●", "-", "-"],
  ["finance.reports.read", "●", "◐", "-", "-"],
  ["finance.statements.export", "●", "◐", "-", "-"],
  // Approvals
  ["approvals.read", "●", "●", "-", "-"],
  ["approvals.decide", "●", "●", "-", "-"],
  // Audit
  ["audit.read", "●", "●", "-", "-"],
  ["audit.export", "●", "●", "-", "-"],
  // Leads
  ["leads.read", "●", "◐", "●", "-"],
  ["leads.read_all", "●", "-", "-", "-"],
  ["leads.write", "●", "◐", "●", "-"],
  ["leads.assign", "●", "◐", "●", "-"],
  // Queries
  ["queries.read", "●", "●", "●", "-"],
  ["queries.reply", "●", "●", "●", "-"],
  ["queries.close", "●", "●", "●", "-"],
  // Chat
  ["chat.transcripts.read", "●", "●", "-", "-"],
  ["chat.prompts.write", "●", "●", "-", "-"],
  // Customers
  ["customers.read", "●", "●", "●", "-"],
  ["customers.notes.write", "●", "●", "●", "-"],
  ["customers.suspend", "●", "●", "-", "-"],
  ["customers.reset_link", "●", "●", "-", "-"],
  // Settings
  ["settings.read", "●", "●", "●", "-"],
  ["settings.write", "●", "-", "-", "-"],
  // Users
  ["users.admin.manage", "●", "-", "-", "-"],
  // Dashboard
  ["dashboard.admin", "●", "●", "●", "-"],
  // Media
  ["media.upload", "●", "●", "●", "-"],
  // Analytics
  ["analytics.read", "●", "●", "-", "-"],
];

const granted = (cell: Cell): boolean => cell !== "-";

/** The customer-only `*.self` family: the only cells a Super Admin does not hold. */
const CUSTOMER_ONLY: readonly Permission[] = [
  "commerce.self",
  "delivery.self",
  "support.self",
  "chat.use",
];

describe("PERMISSIONS (docs/06 §1.2)", () => {
  it("lists exactly the 51 permission strings of the table, in table order, no duplicates", () => {
    expect(PERMISSIONS).toHaveLength(51);
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    expect([...PERMISSIONS]).toEqual(MATRIX.map((row) => row[0]));
  });

  it("defines the four roles of A-201 and the admin-class pair", () => {
    expect([...ROLES]).toEqual(["super_admin", "admin", "staff", "customer"]);
    expect([...ADMIN_CLASS_ROLES]).toEqual(["super_admin", "admin"]);
  });

  it("isPermission / isRole guard arbitrary strings", () => {
    expect(isPermission("catalog.read")).toBe(true);
    expect(isPermission("catalog.*")).toBe(false);
    expect(isRole("admin")).toBe(true);
    expect(isRole("root")).toBe(false);
  });
});

describe("ROLE_PERMISSIONS matrix", () => {
  it.each(ROLES)("%s holds only known permissions, without duplicates", (role) => {
    const list = ROLE_PERMISSIONS[role];
    expect(new Set(list).size).toBe(list.length);
    for (const permission of list) expect(PERMISSIONS).toContain(permission);
  });

  it.each(MATRIX)("row %s → %s %s %s %s", (permission, sa, ad, st, cu) => {
    const cells: Record<Role, Cell> = { super_admin: sa, admin: ad, staff: st, customer: cu };
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role].includes(permission), `${role}:${permission}`).toBe(
        granted(cells[role]),
      );
    }
  });

  it("super_admin holds every permission granted to admin or staff", () => {
    for (const role of ["admin", "staff"] as const) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(ROLE_PERMISSIONS.super_admin, `${role}:${permission}`).toContain(permission);
      }
    }
  });

  it("super_admin lacks only the customer-only *.self family (BR-04: admins buy with a customer account)", () => {
    const missing = PERMISSIONS.filter((p) => !ROLE_PERMISSIONS.super_admin.includes(p));
    expect(missing).toEqual(CUSTOMER_ONLY);
    expect(ROLE_PERMISSIONS.super_admin).toHaveLength(PERMISSIONS.length - CUSTOMER_ONLY.length);
  });

  it("customer is the only role with *.self permissions beyond account.self", () => {
    for (const role of ["super_admin", "admin", "staff"] as const) {
      for (const permission of CUSTOMER_ONLY) {
        expect(ROLE_PERMISSIONS[role]).not.toContain(permission);
      }
    }
    expect([...ROLE_PERMISSIONS.customer]).toEqual([
      "account.self",
      "commerce.self",
      "delivery.self",
      "support.self",
      "chat.use",
    ]);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(ROLE_PERMISSIONS)).toBe(true);
    for (const role of ROLES) expect(Object.isFrozen(ROLE_PERMISSIONS[role])).toBe(true);
  });
});

describe("admin scopes (D-512)", () => {
  it("ADMIN_SCOPED_PERMISSIONS equals the ◐ cells of the admin column", () => {
    const scoped = MATRIX.filter((row) => row[2] === "◐").map((row) => row[0]);
    expect([...ADMIN_SCOPED_PERMISSIONS]).toEqual(scoped);
  });

  it("every ◐ permission has a scope descriptor and every descriptor names a granted cell", () => {
    for (const permission of ADMIN_SCOPED_PERMISSIONS) {
      expect(ADMIN_SCOPES[permission], permission).toBeDefined();
      expect(ADMIN_SCOPES[permission]).not.toBe("all");
    }
    for (const permission of Object.keys(ADMIN_SCOPES) as Permission[]) {
      expect(isPermission(permission)).toBe(true);
    }
  });

  it("encodes the scope column verbatim", () => {
    expect(ADMIN_SCOPES).toEqual({
      "account.self": "own_row",
      "commerce.self": "own_rows",
      "delivery.self": "own_rows",
      "support.self": "own_rows",
      "chat.use": "own_rows",
      "catalog.read": "all",
      "catalog.write": "own_products",
      "catalog.submit": "own_products",
      "catalog.lifecycle.request": "own_products",
      "ownership.propose": "own_products",
      "orders.read": "own_product_orders",
      "invoices.issue": "own_product_orders",
      "invoices.read": "own_product_orders",
      "delivery.tasks.write": "own_products",
      "entitlements.admin": "own_products",
      "finance.ledger.read": "own_partner_lines",
      "finance.payout.record": "any_partner",
      "finance.reports.read": "own_statement",
      "finance.statements.export": "own_statement",
      "approvals.decide": "never_own_requests",
      "leads.read": "assigned_or_pool",
      "leads.write": "assigned_or_pool",
      "leads.assign": "assigned_or_pool",
    });
  });
});

describe("permissionsForRoles", () => {
  it("returns the union across roles, ignoring unknown role strings", () => {
    const set = permissionsForRoles(["customer", "staff", "ghost"]);
    expect(set.has("commerce.self")).toBe(true);
    expect(set.has("catalog.write")).toBe(true);
    expect(set.has("settings.write")).toBe(false);
    expect(set.size).toBe(new Set([...ROLE_PERMISSIONS.customer, ...ROLE_PERMISSIONS.staff]).size);
  });

  it("returns an empty set for no roles", () => {
    expect(permissionsForRoles([]).size).toBe(0);
  });

  it.each(ROLES)("%s alone yields exactly its matrix row", (role) => {
    expect([...permissionsForRoles([role])].sort()).toEqual([...ROLE_PERMISSIONS[role]].sort());
  });
});
