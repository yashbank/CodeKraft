/**
 * One route -> permission map for the admin app, used by the admin layout (server-side guard)
 * and the sidebar filter. Routes not listed are open to every admin-app role (their pages still
 * enforce their own data permissions). `admin_class` = super_admin or admin only.
 */
import { ADMIN_CLASS_ROLES, permissionsForRoles, type Permission, type Role } from "./permissions";

type Needs = Permission | "admin_class";

// Longest prefix wins. Paths are relative to /admin.
const ADMIN_ROUTE_PERMISSIONS: ReadonlyArray<readonly [string, Needs]> = [
  ["/finance/ledger", "finance.ledger.read"],
  ["/finance/allocations", "finance.ledger.read"],
  ["/finance/partners", "finance.payout.record"],
  ["/finance/expenses", "finance.expense.write"],
  ["/finance/adjustments", "finance.adjustment.propose"],
  ["/admin-users", "admin_class"],
  ["/audit", "audit.read"],
  ["/approvals", "approvals.read"],
];

/** Normalise `/admin/x?y` or `/x` to `/x`. */
function relPath(path: string): string {
  const p = (path.split("?")[0] ?? "").replace(/^\/admin(?=\/|$)/, "");
  return p === "" ? "/" : p;
}

export function canOpenAdminRoute(roles: readonly Role[], path: string): boolean {
  const p = relPath(path);
  const hit = ADMIN_ROUTE_PERMISSIONS.filter(
    ([prefix]) => p === prefix || p.startsWith(`${prefix}/`),
  ).sort((a, b) => b[0].length - a[0].length)[0];
  if (!hit) return true;
  if (hit[1] === "admin_class") return roles.some((r) => ADMIN_CLASS_ROLES.includes(r));
  return permissionsForRoles(roles).has(hit[1]);
}

interface NavLike {
  route?: string;
  children?: Array<{ route: string }>;
}

/** Drop nav items the role cannot open; drop parents/groups left empty. */
export function filterAdminNav<G extends { items: NavLike[] }>(
  nav: G[],
  roles: readonly Role[],
): G[] {
  const ok = (r: string) => canOpenAdminRoute(roles, r);
  return nav
    .map((g) => ({
      ...g,
      items: g.items
        .map((i) => (i.children ? { ...i, children: i.children.filter((c) => ok(c.route)) } : i))
        .filter((i) => (i.children ? i.children.length > 0 : ok(i.route ?? ""))),
    }))
    .filter((g) => g.items.length > 0);
}
