/** Loads a user's role keys per request (never from the token — docs/09 §4). Wired to user_roles here; P2 may replace. */
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { userRoles } from "../../../drizzle/schema/auth";
import { ADMIN_CLASS_ROLES, isRole, type Role } from "@/lib/authz/permissions";

export type RolesLoader = (userId: string) => Promise<Role[]>;

let loader: RolesLoader = async (userId) => {
  const rows = await getDb()
    .select({ key: userRoles.roleKey })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.key).filter(isRole);
};

export function setRolesLoader(next: RolesLoader): void {
  loader = next;
}

export function loadRoles(userId: string): Promise<Role[]> {
  return loader(userId);
}

export function hasAdminClassRole(roles: readonly Role[]): boolean {
  return roles.some((r) => (ADMIN_CLASS_ROLES as readonly string[]).includes(r));
}
