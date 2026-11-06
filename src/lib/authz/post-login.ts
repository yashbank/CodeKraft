/**
 * One rule for "where does a freshly signed-in user belong?" (docs/09 §3). Used by the Google /
 * social callback landing page, the account area guard and the email sign-in role probe, so every
 * sign-in path agrees:
 *   - super_admin, admin and staff live in the ADMIN area only;
 *   - everyone else (customers, or users with no role rows) lives in the customer area only.
 * Pure and edge/client safe: no database or framework imports.
 */
import { ADMIN_CLASS_ROLES, type Role } from "./permissions";

/** Roles that may open the admin app. Staff are included (they see only what their permissions allow). */
export const ADMIN_AREA_ROLES: readonly Role[] = [...ADMIN_CLASS_ROLES, "staff"];

export type LoginArea = "admin" | "customer";

export interface PostLoginDestination {
  area: LoginArea;
  /** Path to open inside that area (the admin dashboard, or the requested customer page). */
  path: string;
}

/** True when any of the roles belongs in the admin area. */
export function isAdminAreaUser(roles: readonly string[]): boolean {
  return roles.some((r) => (ADMIN_AREA_ROLES as readonly string[]).includes(r));
}

/**
 * Decide the landing area and path. `customerNext` must already be a safe same-site path
 * (see safeRedirectPath); admin users ignore it and always land on the admin dashboard.
 */
export function postLoginDestination(
  roles: readonly string[],
  customerNext = "/account",
): PostLoginDestination {
  if (isAdminAreaUser(roles)) return { area: "admin", path: "/dashboard" };
  return { area: "customer", path: customerNext };
}
