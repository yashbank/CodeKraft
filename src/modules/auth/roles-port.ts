/** Loads a user's role keys per request (never from the token — docs/09 §4). Wired to user_roles here; P2 may replace. */
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { userRoles } from "../../../drizzle/schema/auth";
import { isRole, type Role } from "@/lib/authz/permissions";
import { ADMIN_AREA_ROLES, isAdminAreaUser } from "@/lib/authz/post-login";

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

/**
 * May this user hold an admin-host session / open the admin app? Includes `staff` (R8-09: staff
 * invited by a super admin could not sign in to admin at all). Staff see only what their
 * permissions allow; `ADMIN_CLASS_ROLES` (super_admin/admin) keeps its narrower meaning elsewhere.
 */
export const ADMIN_APP_ROLES: readonly Role[] = ADMIN_AREA_ROLES;

export function hasAdminClassRole(roles: readonly Role[]): boolean {
  return isAdminAreaUser(roles);
}
