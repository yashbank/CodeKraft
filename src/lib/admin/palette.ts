import { ROLE_PERMISSIONS, type Permission } from "@/lib/authz/permissions";
import type { SearchItem } from "@/components/admin/types";

type AdminRole = "super_admin" | "admin" | "staff";

/** Quick actions offered in the palette; each shows only when the role holds the permission. */
const QUICK_ACTIONS: ReadonlyArray<{ label: string; route: string; permission: Permission }> = [
  { label: "New product", route: "/products/new", permission: "catalog.write" },
  { label: "New coupon", route: "/coupons", permission: "catalog.write" },
  { label: "Record expense", route: "/finance/expenses", permission: "finance.expense.write" },
  { label: "Invite user", route: "/admin-users", permission: "users.admin.manage" },
];

export function quickActionsFor(
  role: AdminRole | undefined,
  href: (route: string) => string,
): SearchItem[] {
  const perms = role ? ROLE_PERMISSIONS[role] : [];
  return QUICK_ACTIONS.filter((a) => perms.includes(a.permission)).map((a) => ({
    group: "Actions",
    label: a.label,
    href: href(a.route),
  }));
}

/** ⌘K / Ctrl+K anywhere; "/" only when the user is not typing in a field. */
export function isPaletteShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey?: boolean;
  target: EventTarget | null;
}): boolean {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") return true;
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return false;
  const el = e.target as HTMLElement | null;
  return !(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}
