/**
 * Better Auth hooks (docs/09 §3): single active session (D-1203), admin-host gate, password policy,
 * TOTP restricted to admin-class roles, audit events (FR-AUTH-13).
 */
import { and, eq, ne } from "drizzle-orm";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

import { randomUUID } from "node:crypto";
import { audit } from "@/lib/audit-port";
import { checkFormGuard } from "@/lib/form-guard";
import { checkClass, type RateLimitClass, type RateLimitScope } from "@/lib/rate-limit";
import { getDb } from "@/lib/db";
import { sessions, userRoles, users } from "../../../drizzle/schema/auth";
import { passwordPolicyMessage, validatePassword } from "./password-policy";
import { hasAdminClassRole, loadRoles } from "./roles-port";

export type AuthHost = "site" | "admin";

const PASSWORD_PATHS = new Set([
  "/sign-up/email",
  "/change-password",
  "/reset-password",
  "/set-password",
]);
const TOTP_PATH_PREFIX = "/two-factor/";
const SIGN_IN_PATHS = new Set([
  "/sign-in/email",
  "/sign-in/phone-number",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);

/** Auth endpoints -> rate-limit class and the body field that identifies the account. */
const RATE_LIMITED_PATHS: Record<string, { cls: RateLimitClass; field?: string }> = {
  "/sign-in/email": { cls: "login", field: "email" },
  "/sign-in/phone-number": { cls: "login", field: "phoneNumber" },
  "/sign-up/email": { cls: "signup" },
  "/request-password-reset": { cls: "reset", field: "email" },
  "/forget-password": { cls: "reset", field: "email" },
  "/reset-password": { cls: "reset" },
  "/phone-number/send-otp": { cls: "otp", field: "phoneNumber" },
  "/phone-number/verify": { cls: "otp", field: "phoneNumber" },
};
const ACCOUNT_SCOPE: Record<string, RateLimitScope> = {
  login: "account",
  reset: "email",
  otp: "phone",
};

/**
 * Headroom over the canonical docs/06 §1.7 table for the HTTP wiring (shared NAT IPs, e2e runs).
 * The store is in-memory per serverless instance, so these are best-effort brute-force brakes.
 */
function authLimitScale(): number {
  const n = Number(process.env.AUTH_RATE_LIMIT_SCALE);
  return Number.isFinite(n) && n >= 1 ? n : 4;
}

function clientIp(headers: Headers | undefined): string | null {
  return (
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || headers?.get("x-real-ip") || null
  );
}

function requestMeta(headers: Headers | undefined) {
  return {
    ip: headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headers?.get("user-agent") ?? null,
  };
}

/** Runs before every auth endpoint. Errors are RETURNED (not thrown): Better Auth converts a returned APIError into the response, while thrown before-hook errors propagate to the caller (api/dispatch.mjs runBeforeHooks). */
export function beforeHook(host: AuthHost) {
  return createAuthMiddleware(async (ctx) => {
    // Brute-force brakes (login / signup / reset / otp classes), per IP and per account key.
    // Only real HTTP requests: server-side `auth.api.*` calls (seed, tests) have no request.
    const limited = ctx.request ? RATE_LIMITED_PATHS[ctx.path] : undefined;
    if (limited) {
      const body = (ctx.body ?? {}) as Record<string, unknown>;
      const raw = limited.field ? body[limited.field] : undefined;
      const subjects: Partial<Record<RateLimitScope, string>> = {};
      const ip = clientIp(ctx.request?.headers);
      if (ip) subjects.ip = ip;
      const accountScope = ACCOUNT_SCOPE[limited.cls];
      if (accountScope && typeof raw === "string" && raw.trim() !== "") {
        subjects[accountScope] = raw.trim().toLowerCase();
      }
      if (Object.keys(subjects).length > 0) {
        const res = await checkClass(limited.cls, subjects, { scale: authLimitScale() });
        if (!res.allowed) {
          return ctx.error("TOO_MANY_REQUESTS", {
            message: "Too many attempts. Please wait a while and try again.",
            code: "RATE_LIMITED",
          });
        }
      }
    }
    // Invisible bot guard on public registration: honeypot filled, or submitted < 2 s after the
    // form rendered (signed timestamp) => accept-and-drop with a normal-looking success, no user.
    // Only real HTTP requests: server-side `auth.api.signUpEmail` (seed, tests) has no request.
    if (ctx.path === "/sign-up/email" && ctx.request) {
      const body = (ctx.body ?? {}) as {
        email?: unknown;
        name?: unknown;
        formGuardHp?: unknown;
        formGuardToken?: unknown;
      };
      if (checkFormGuard({ honeypot: body.formGuardHp, token: body.formGuardToken }) !== "ok") {
        const now = new Date().toISOString();
        return ctx.json({
          token: null,
          user: {
            id: randomUUID(),
            email: typeof body.email === "string" ? body.email : "",
            name: typeof body.name === "string" ? body.name : "",
            image: null,
            emailVerified: false,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    }
    // Password policy on every password-setting endpoint (docs/09 §3.2)
    if (PASSWORD_PATHS.has(ctx.path)) {
      const body = (ctx.body ?? {}) as {
        password?: unknown;
        newPassword?: unknown;
        email?: unknown;
      };
      const pw = typeof body.newPassword === "string" ? body.newPassword : body.password;
      if (typeof pw === "string") {
        const email =
          typeof body.email === "string" ? body.email : (ctx.context.session?.user.email ?? null);
        const err = validatePassword(pw, { email, isAdmin: host === "admin" });
        if (err)
          return ctx.error("BAD_REQUEST", {
            message: passwordPolicyMessage(err, { isAdmin: host === "admin" }),
            code: "PASSWORD_POLICY",
          });
      }
    }
    // TOTP management only for admin-class accounts (D-1202, D-208); verification endpoints stay open
    if (ctx.path.startsWith(TOTP_PATH_PREFIX) && !ctx.path.startsWith("/two-factor/verify")) {
      const session = await getSessionFromCtx(ctx).catch(() => null);
      const userId = session?.user.id;
      if (!userId)
        return ctx.error("UNAUTHORIZED", { message: "Sign in first.", code: "UNAUTHENTICATED" });
      const roles = await loadRoles(userId);
      if (!hasAdminClassRole(roles))
        return ctx.error("FORBIDDEN", {
          message: "Two-factor authentication is available to admin accounts only.",
          code: "FORBIDDEN",
        });
    }
  });
}

/** Runs after every auth endpoint. */
export function afterHook(host: AuthHost) {
  return createAuthMiddleware(async (ctx) => {
    const newSession = ctx.context.newSession;
    const meta = requestMeta(ctx.request?.headers ?? ctx.headers ?? undefined);

    // Super admin bootstrap for designated founder emails — runs on ANY successful
    // sign-up or sign-in (email, social, whatever), not just /sign-up/email, since a
    // Google-first login otherwise never gets granted the role. Idempotent (onConflictDoNothing),
    // so safe to re-check on every login; also self-heals accounts that were created
    // before this fix shipped.
    if (newSession?.user) {
      const email = newSession.user.email?.toLowerCase();
      const BOOTSTRAP_ADMINS = ["yashbank2002@gmail.com", "sanketshrikant42@gmail.com"];
      if (email && BOOTSTRAP_ADMINS.includes(email)) {
        const db = getDb();
        await db
          .insert(userRoles)
          .values({ userId: newSession.user.id, roleKey: "super_admin" })
          .onConflictDoNothing();
        await db.update(users).set({ emailVerified: true }).where(eq(users.id, newSession.user.id));
      }
    }

    if (newSession && SIGN_IN_PATHS.has(ctx.path)) {
      const db = getDb();
      const userId = newSession.user.id;

      // Suspended accounts never get a session (FR-AUTH-12)
      const [u] = await db
        .select({ status: users.status })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (u?.status !== "active") {
        await db.delete(sessions).where(eq(sessions.userId, userId)); // no session survives for a non-active account
        await audit({
          action: "auth.sign_in.rejected_status",
          actorId: userId,
          meta: { status: u?.status ?? "missing", host },
          ...meta,
        });
        throw ctx.error("FORBIDDEN", {
          message: "This account is not active.",
          code: "ACCOUNT_SUSPENDED",
        });
      }

      // Admin host: only admin-class roles may hold a session there (docs/09 §3.1)
      if (host === "admin") {
        const roles = await loadRoles(userId);
        if (!hasAdminClassRole(roles)) {
          await db.delete(sessions).where(eq(sessions.token, newSession.session.token));
          await audit({
            action: "auth.admin_host.rejected",
            actorId: userId,
            meta: { host },
            ...meta,
          });
          // Credentials were already verified here, so naming the real reason leaks nothing.
          throw ctx.error("FORBIDDEN", {
            message: "This account doesn't have admin access.",
            code: "ADMIN_ACCESS_REQUIRED",
          });
        }
      }

      // Tag the session with its host and end every other session of this user (D-1203)
      await db.update(sessions).set({ host }).where(eq(sessions.token, newSession.session.token));
      const replaced = await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), ne(sessions.token, newSession.session.token)))
        .returning({ id: sessions.id });
      await audit({
        action: "auth.sign_in",
        actorId: userId,
        subjectType: "session",
        subjectId: newSession.session.id,
        meta: { host, replaced: replaced.length },
        ...meta,
      });
      if (replaced.length > 0)
        await audit({
          action: "auth.session_replaced",
          actorId: userId,
          meta: { host, count: replaced.length },
          ...meta,
        });
      return;
    }

    const actorId = ctx.context.session?.user.id ?? null;
    // Better Auth's own change-password must clear the forced-change flag too (success only).
    if (ctx.path === "/change-password" && actorId && !(ctx.context.returned instanceof Error))
      await getDb().update(users).set({ mustChangePassword: false }).where(eq(users.id, actorId));
    const AUDITED: Record<string, string> = {
      "/sign-out": "auth.sign_out",
      "/sign-up/email": "auth.sign_up",
      "/verify-email": "auth.email_verified",
      "/request-password-reset": "auth.password_reset.requested",
      "/reset-password": "auth.password_reset.completed",
      "/change-password": "auth.password_changed",
      "/change-email": "auth.email_change.requested",
      "/delete-user": "auth.delete_requested",
      "/two-factor/enable": "auth.totp.enabled",
      "/two-factor/disable": "auth.totp.disabled",
      "/two-factor/generate-backup-codes": "auth.totp.backup_codes_regenerated",
      "/phone-number/send-otp": "auth.phone_otp.sent",
      "/phone-number/verify": "auth.phone_verified",
    };
    const action = AUDITED[ctx.path];
    if (action) await audit({ action, actorId, meta: { host }, ...meta });
  });
}
