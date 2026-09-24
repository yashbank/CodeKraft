/**
 * Request context — docs/06 §1.1, docs/09 §4.2.
 *
 * Pure shapes and builders only. The Better Auth wiring (session lookup, `user_roles` load,
 * admin-host rule, `EMAIL_UNVERIFIED` / `ACCOUNT_SUSPENDED` gates) is P1.5/P1.7; they call
 * `buildContext` with what they loaded so this module stays unit-testable without a request.
 */
import { AppError, ErrorCode } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { type Permission, type Role, isRole, permissionsForRoles } from "./permissions";

export interface RequestContext {
  readonly userId: string;
  readonly roles: readonly Role[];
  readonly permissions: ReadonlySet<Permission>;
  /** Present when the user is a partner (`T-partners`); drives D-512 scopes. */
  readonly partnerId?: string;
  readonly sessionId: string;
  readonly ip?: string;
  readonly userAgent?: string;
  readonly requestId: string;
}

/** A request without a session. `userId: null` is the discriminant. */
export interface AnonymousContext {
  readonly userId: null;
  readonly roles: readonly Role[];
  readonly permissions: ReadonlySet<Permission>;
  readonly partnerId?: undefined;
  readonly sessionId?: undefined;
  readonly ip?: string;
  readonly userAgent?: string;
  readonly requestId: string;
}

export type Context = RequestContext | AnonymousContext;

export interface BuildContextInput {
  user: { id: string };
  session: { id: string };
  /** Role names loaded from `user_roles` for this request (never from the token). */
  roles: readonly string[];
  partnerId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AnonymousContextInput {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

const EMPTY_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>();

function optional(value: string | null | undefined): string | undefined {
  return value === null || value === undefined || value === "" ? undefined : value;
}

/** Build an authenticated context. Unknown role strings are dropped; duplicates collapse. */
export function buildContext(input: BuildContextInput): RequestContext {
  const roles = Array.from(new Set(input.roles.filter(isRole)));
  const ctx: RequestContext = {
    userId: input.user.id,
    roles,
    permissions: permissionsForRoles(roles),
    sessionId: input.session.id,
    requestId: optional(input.requestId) ?? newId(),
    ...(optional(input.partnerId) !== undefined ? { partnerId: optional(input.partnerId) } : {}),
    ...(optional(input.ip) !== undefined ? { ip: optional(input.ip) } : {}),
    ...(optional(input.userAgent) !== undefined ? { userAgent: optional(input.userAgent) } : {}),
  };
  return Object.freeze(ctx);
}

export function anonymousContext(input: AnonymousContextInput = {}): AnonymousContext {
  const ctx: AnonymousContext = {
    userId: null,
    roles: [],
    permissions: EMPTY_PERMISSIONS,
    requestId: optional(input.requestId) ?? newId(),
    ...(optional(input.ip) !== undefined ? { ip: optional(input.ip) } : {}),
    ...(optional(input.userAgent) !== undefined ? { userAgent: optional(input.userAgent) } : {}),
  };
  return Object.freeze(ctx);
}

export function isAuthenticated(ctx: Context): ctx is RequestContext {
  return ctx.userId !== null;
}

/** Narrow to an authenticated context or throw `UNAUTHENTICATED` (docs/06 §1.1). */
export function requireContext(ctx: Context): RequestContext {
  if (!isAuthenticated(ctx)) throw new AppError(ErrorCode.UNAUTHENTICATED);
  return ctx;
}
