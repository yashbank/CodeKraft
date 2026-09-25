/**
 * Permission strings and role matrix — verbatim from docs/06 §1.2 (`T-permissions`,
 * `T-role_permissions`), D-512 admin data scopes, A-201 roles.
 *
 * This file is the single source of truth in code; `tests/unit/authz/permissions.test.ts`
 * encodes the docs/06 table explicitly so drift in either direction fails CI.
 */

export const PERMISSIONS = [
  // Self
  "account.self",
  "commerce.self",
  "delivery.self",
  "support.self",
  "chat.use",
  // Catalog
  "catalog.read",
  "catalog.write",
  "catalog.submit",
  "catalog.lifecycle.request",
  "ownership.propose",
  // Content
  "content.read",
  "content.write",
  "content.publish",
  // Commerce
  "orders.read",
  "orders.manual.write",
  // Payments
  "payments.confirm",
  "refunds.propose",
  // Invoices
  "invoices.issue",
  "invoices.read",
  // Delivery
  "delivery.tasks.write",
  "entitlements.admin",
  // Finance
  "finance.ledger.read",
  "finance.ledger.read_all",
  "finance.payout.record",
  "finance.expense.write",
  "finance.adjustment.propose",
  "finance.reports.read",
  "finance.statements.export",
  // Approvals
  "approvals.read",
  "approvals.decide",
  // Audit
  "audit.read",
  "audit.export",
  // Leads
  "leads.read",
  "leads.read_all",
  "leads.write",
  "leads.assign",
  // Queries
  "queries.read",
  "queries.reply",
  "queries.close",
  // Chat
  "chat.transcripts.read",
  "chat.prompts.write",
  // Customers
  "customers.read",
  "customers.notes.write",
  "customers.suspend",
  "customers.reset_link",
  // Settings
  "settings.read",
  "settings.write",
  // Users
  "users.admin.manage",
  // Dashboard
  "dashboard.admin",
  // Media
  "media.upload",
  // Analytics
  "analytics.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["super_admin", "admin", "staff", "customer"] as const;
export type Role = (typeof ROLES)[number];

/** Roles that may use the admin app (docs/06 §1.1 "admin-class"). */
export const ADMIN_CLASS_ROLES: readonly Role[] = ["super_admin", "admin"];

/**
 * Typed descriptors for the "Admin scope (D-512)" column. Only the `admin` role is scoped;
 * `super_admin` is also a partner (seed §14) so scopes never apply, and `staff`/`customer`
 * cells are either full grants (●) or absent (—).
 */
export type AdminScope =
  | "all"
  | "own_row"
  | "own_rows"
  | "own_products"
  | "own_product_orders"
  | "own_partner_lines"
  | "own_statement"
  | "any_partner"
  | "never_own_requests"
  | "assigned_or_pool";

/**
 * The permission the `admin` role holds with a scope (◐ in docs/06 §1.2), or `all`/`own_row(s)`
 * when the table names a scope for an unscoped grant. Absent = no scope column entry ("—").
 */
export const ADMIN_SCOPES: Readonly<Partial<Record<Permission, AdminScope>>> = Object.freeze({
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

/** Permissions granted to `admin` with a data scope (◐ cells). */
export const ADMIN_SCOPED_PERMISSIONS: readonly Permission[] = [
  "catalog.write",
  "catalog.submit",
  "catalog.lifecycle.request",
  "ownership.propose",
  "orders.read",
  "invoices.issue",
  "invoices.read",
  "delivery.tasks.write",
  "entitlements.admin",
  "finance.ledger.read",
  "finance.reports.read",
  "finance.statements.export",
  "leads.read",
  "leads.write",
  "leads.assign",
];

const SUPER_ADMIN: readonly Permission[] = [
  "account.self",
  "catalog.read",
  "catalog.write",
  "catalog.submit",
  "catalog.lifecycle.request",
  "ownership.propose",
  "content.read",
  "content.write",
  "content.publish",
  "orders.read",
  "orders.manual.write",
  "payments.confirm",
  "refunds.propose",
  "invoices.issue",
  "invoices.read",
  "delivery.tasks.write",
  "entitlements.admin",
  "finance.ledger.read",
  "finance.ledger.read_all",
  "finance.payout.record",
  "finance.expense.write",
  "finance.adjustment.propose",
  "finance.reports.read",
  "finance.statements.export",
  "approvals.read",
  "approvals.decide",
  "audit.read",
  "audit.export",
  "leads.read",
  "leads.read_all",
  "leads.write",
  "leads.assign",
  "queries.read",
  "queries.reply",
  "queries.close",
  "chat.transcripts.read",
  "chat.prompts.write",
  "customers.read",
  "customers.notes.write",
  "customers.suspend",
  "customers.reset_link",
  "settings.read",
  "settings.write",
  "users.admin.manage",
  "dashboard.admin",
  "media.upload",
  "analytics.read",
];

const ADMIN: readonly Permission[] = [
  "account.self",
  "catalog.read",
  "catalog.write",
  "catalog.submit",
  "catalog.lifecycle.request",
  "ownership.propose",
  "content.read",
  "content.write",
  "content.publish",
  "orders.read",
  "orders.manual.write",
  "payments.confirm",
  "refunds.propose",
  "invoices.issue",
  "invoices.read",
  "delivery.tasks.write",
  "entitlements.admin",
  "finance.ledger.read",
  "finance.payout.record",
  "finance.expense.write",
  "finance.adjustment.propose",
  "finance.reports.read",
  "finance.statements.export",
  "approvals.read",
  "approvals.decide",
  "audit.read",
  "audit.export",
  "leads.read",
  "leads.write",
  "leads.assign",
  "queries.read",
  "queries.reply",
  "queries.close",
  "chat.transcripts.read",
  "chat.prompts.write",
  "customers.read",
  "customers.notes.write",
  "customers.suspend",
  "customers.reset_link",
  "settings.read",
  "dashboard.admin",
  "media.upload",
  "analytics.read",
];

const STAFF: readonly Permission[] = [
  "account.self",
  "catalog.read",
  "catalog.write",
  "content.read",
  "content.write",
  "orders.read",
  "invoices.issue",
  "invoices.read",
  "delivery.tasks.write",
  "leads.read",
  "leads.write",
  "leads.assign",
  "queries.read",
  "queries.reply",
  "queries.close",
  "customers.read",
  "customers.notes.write",
  "settings.read",
  "dashboard.admin",
  "media.upload",
];

const CUSTOMER: readonly Permission[] = [
  "account.self",
  "commerce.self",
  "delivery.self",
  "support.self",
  "chat.use",
];

/** docs/06 §1.2 role → permission matrix (● and ◐ cells). */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = Object.freeze({
  super_admin: Object.freeze([...SUPER_ADMIN]),
  admin: Object.freeze([...ADMIN]),
  staff: Object.freeze([...STAFF]),
  customer: Object.freeze([...CUSTOMER]),
});

const PERMISSION_SET: ReadonlySet<string> = new Set<string>(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Union of the permissions of every given role (unknown role strings are ignored). */
export function permissionsForRoles(roles: readonly string[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const role of roles) {
    if (!isRole(role)) continue;
    for (const permission of ROLE_PERMISSIONS[role]) out.add(permission);
  }
  return out;
}
