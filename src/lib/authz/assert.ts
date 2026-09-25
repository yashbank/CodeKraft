/**
 * Permission assertions — docs/06 §1.2, docs/09 §4.2 (checked inside every Server Action
 * after the Zod parse, independent of layout gates: FR-AUTH-10, D-1103).
 */
import { AppError, ErrorCode } from "@/lib/errors";
import { type Context, type RequestContext, isAuthenticated } from "./context";
import { ADMIN_CLASS_ROLES, type Permission, type Role } from "./permissions";

export function can(ctx: Context, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

export function canAny(ctx: Context, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => ctx.permissions.has(permission));
}

export function hasRole(ctx: Context, role: Role): boolean {
  return ctx.roles.includes(role);
}

/** `super_admin` or `admin` (docs/06 §1.1 admin-class). */
export function isAdminClass(ctx: Context): boolean {
  return ADMIN_CLASS_ROLES.some((role) => ctx.roles.includes(role));
}

function forbidden(permission: string): AppError {
  return new AppError(ErrorCode.FORBIDDEN, undefined, { cause: { missing: permission } });
}

function unauthenticated(): AppError {
  return new AppError(ErrorCode.UNAUTHENTICATED);
}

/** Throw `UNAUTHENTICATED` for anonymous callers, `FORBIDDEN` when the permission is missing. */
export function assertPermission(
  ctx: Context,
  permission: Permission,
): asserts ctx is RequestContext {
  if (!isAuthenticated(ctx)) throw unauthenticated();
  if (!can(ctx, permission)) throw forbidden(permission);
}

/** Passes when the caller holds at least one of `permissions`. */
export function assertAnyPermission(
  ctx: Context,
  permissions: readonly Permission[],
): asserts ctx is RequestContext {
  if (!isAuthenticated(ctx)) throw unauthenticated();
  if (!canAny(ctx, permissions)) throw forbidden(permissions.join("|"));
}

/** Passes when the caller holds at least one of the given roles. */
export function assertRole(
  ctx: Context,
  role: Role | readonly Role[],
): asserts ctx is RequestContext {
  if (!isAuthenticated(ctx)) throw unauthenticated();
  const wanted: readonly Role[] = typeof role === "string" ? [role] : role;
  if (!wanted.some((r) => hasRole(ctx, r))) throw forbidden(`role:${wanted.join("|")}`);
}

export function assertAdminClass(ctx: Context): asserts ctx is RequestContext {
  assertRole(ctx, ADMIN_CLASS_ROLES);
}

/**
 * `*.self` style check: the caller must be the row owner and hold `permission`, or hold
 * `elevated` (an admin-class permission that grants access to other users' rows).
 * Example: `assertSelfOr(ctx, order.userId, "commerce.self", "orders.read")`.
 */
export function assertSelfOr(
  ctx: Context,
  ownerUserId: string,
  permission: Permission,
  elevated?: Permission,
): asserts ctx is RequestContext {
  if (!isAuthenticated(ctx)) throw unauthenticated();
  if (ctx.userId === ownerUserId && can(ctx, permission)) return;
  if (elevated !== undefined && can(ctx, elevated)) return;
  throw forbidden(elevated === undefined ? permission : `${permission}|${elevated}`);
}
