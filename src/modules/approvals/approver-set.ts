/**
 * Approver set (MASTER_SPEC §7 "Approver set", BR-13, A-1101): every *active* user holding the
 * `super_admin` or `admin` role, except the requester. Computed at decision time (never stored),
 * so an admin added mid-flight becomes a required approver for still-pending requests.
 */
import { and, eq, inArray, ne } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { ADMIN_CLASS_ROLES } from "@/lib/authz/permissions";
import { userRoles, users } from "../../../drizzle/schema/auth";

/** Dual approval needs at least two active admin-class users (FR-ADM-12 edge case). */
export const MIN_ACTIVE_ADMINS = 2;

export interface AdminClassUserRow {
  userId: string;
  roleKey: string;
  status: string;
}

/** Pure: distinct active admin-class user ids, sorted, minus the requester. */
export function computeApproverSet(
  rows: readonly AdminClassUserRow[],
  requesterId: string,
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.status !== "active") continue;
    if (!(ADMIN_CLASS_ROLES as readonly string[]).includes(row.roleKey)) continue;
    if (row.userId === requesterId) continue;
    ids.add(row.userId);
  }
  return [...ids].sort();
}

/** Distinct ids of every active `super_admin` / `admin` (sorted). */
export async function loadAdminClassUserIds(db: DbOrTx): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(inArray(userRoles.roleKey, [...ADMIN_CLASS_ROLES]), eq(users.status, "active")));
  return rows.map((r) => r.userId).sort();
}

/** The required approvers for a request raised by `requesterId`. */
export async function loadApproverSet(requesterId: string, db: DbOrTx): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(
      and(
        inArray(userRoles.roleKey, [...ADMIN_CLASS_ROLES]),
        eq(users.status, "active"),
        ne(userRoles.userId, requesterId),
      ),
    );
  return rows.map((r) => r.userId).sort();
}
