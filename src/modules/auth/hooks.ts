/**
 * Better Auth hooks (docs/09 §3): single active session (D-1203), admin-host gate, password policy,
 * TOTP restricted to admin-class roles, audit events (FR-AUTH-13).
 */
import { and, eq, ne } from "drizzle-orm";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

import { audit } from "@/lib/audit-port";
import { getDb } from "@/lib/db";
import { sessions, users } from "../../../drizzle/schema/auth";
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

function requestMeta(headers: Headers | undefined) {
  return {
    ip: headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headers?.get("user-agent") ?? null,
  };
}

/** Runs before every auth endpoint. Errors are RETURNED (not thrown): Better Auth converts a returned APIError into the response, while thrown before-hook errors propagate to the caller (api/dispatch.mjs runBeforeHooks). */
export function beforeHook(host: AuthHost) {
  return createAuthMiddleware(async (ctx) => {
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
          throw ctx.error("UNAUTHORIZED", {
            message: "Invalid email or password.",
            code: "INVALID_CREDENTIALS",
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
