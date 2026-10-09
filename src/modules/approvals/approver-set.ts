/**
 * Approver set calculation (MASTER_SPEC §4.5, §7 "Approver set"; BR-13; PHASE-03 P3.2).
 * The approver set is dynamically computed: every active admin-class user
 * (roles 'super_admin' or 'admin') except the requester.
 */
import { and, eq, inArray, ne } from "drizzle-orm";
import { userRoles, users } from "../../../drizzle/schema/auth";
import type { DbOrTx } from "@/lib/db";

export async function computeApproverSet(requesterId: string, database: DbOrTx): Promise<string[]> {
  const adminRows = await database
    .select({ userId: users.id })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .where(
      and(
        eq(users.status, "active"),
        inArray(userRoles.roleKey, ["super_admin", "admin"]),
        ne(users.id, requesterId),
      ),
    );

  const distinctIds = Array.from(new Set(adminRows.map((r) => r.userId)));
  return distinctIds;
}

export async function countActiveAdmins(database: DbOrTx): Promise<number> {
  const adminRows = await database
    .select({ userId: users.id })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .where(and(eq(users.status, "active"), inArray(userRoles.roleKey, ["super_admin", "admin"])));

  return new Set(adminRows.map((r) => r.userId)).size;
}

/**
 * Admin-class directory (id/name/email/role) for assignment dropdowns and actor-name resolution
 * across the P6 admin screens (leads assignee picker, queries assignee picker, approvals
 * requester/decision names). Reuses the same `users` + `user_roles` join as `computeApproverSet`
 * above; there is no dedicated "list admins" service method anywhere in this codebase (see the
 * same gap documented in `src/lib/admin/finance-view.ts`), so this lives here rather than being
 * fabricated in a view mapper. A user with more than one admin-class role is labelled by the
 * highest one (super_admin > admin > staff).
 */
export interface AdminDirectoryEntry {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "staff";
}

const ROLE_RANK: Record<string, number> = { super_admin: 3, admin: 2, staff: 1 };

export async function listActiveAdminUsers(database: DbOrTx): Promise<AdminDirectoryEntry[]> {
  const rows = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roleKey: userRoles.roleKey,
    })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .where(
      and(
        eq(users.status, "active"),
        inArray(userRoles.roleKey, ["super_admin", "admin", "staff"]),
      ),
    );

  const byId = new Map<string, AdminDirectoryEntry>();
  for (const r of rows) {
    const role = r.roleKey as AdminDirectoryEntry["role"];
    const existing = byId.get(r.id);
    if (!existing || (ROLE_RANK[role] ?? 0) > (ROLE_RANK[existing.role] ?? 0)) {
      byId.set(r.id, { id: r.id, name: r.name || r.email, email: r.email, role });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
