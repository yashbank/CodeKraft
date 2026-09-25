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
