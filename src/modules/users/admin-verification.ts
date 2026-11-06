/**
 * Admin "verification status" and the safe-removal guard for super admins.
 *
 * A login counts as verified when the account can actually sign in (a password or a linked Google
 * account), the email is marked verified, and at least one sign-in has really succeeded
 * (an `auth.sign_in` audit row, or a live session as a fallback). This lets the owner prove the
 * new super admins work before the old ones are removed.
 */
import { and, eq, inArray, max, ne } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { auditLogs } from "../../../drizzle/schema/audit";
import { accounts, sessions, userRoles, users } from "../../../drizzle/schema/auth";
import { partners } from "../../../drizzle/schema/users-ext";

export type AdminRoleKey = "super_admin" | "admin" | "staff";
const RANK: Record<AdminRoleKey, number> = { super_admin: 3, admin: 2, staff: 1 };

/** How many OTHER verified active super admins must exist before a super admin may be removed. */
export const MIN_OTHER_VERIFIED_SUPER_ADMINS = 2;

export interface AdminVerification {
  userId: string;
  name: string;
  email: string;
  role: AdminRoleKey;
  status: "active" | "suspended" | "deleted";
  emailVerified: boolean;
  /** Ways the person can sign in: a saved password and/or a linked Google account. */
  signInMethods: ("password" | "google")[];
  canSignIn: boolean;
  hasSignedIn: boolean;
  lastSignInAt: string | null;
  isPartner: boolean;
  /** Email verified + can sign in + has signed in at least once. */
  verified: boolean;
  /** Plain-English list of what is still missing; empty when verified. */
  missing: string[];
}

/** One row per admin-class user (highest role wins), or only the given ids. */
export async function listAdminVerification(
  database: DbOrTx,
  onlyIds?: readonly string[],
): Promise<AdminVerification[]> {
  const roleRows = await database
    .select({ userId: userRoles.userId, roleKey: userRoles.roleKey })
    .from(userRoles)
    .where(inArray(userRoles.roleKey, ["super_admin", "admin", "staff"]));
  const roleBy = new Map<string, AdminRoleKey>();
  for (const r of roleRows) {
    const role = r.roleKey as AdminRoleKey;
    const cur = roleBy.get(r.userId);
    if (!cur || RANK[role] > RANK[cur]) roleBy.set(r.userId, role);
  }
  const ids = [...roleBy.keys()].filter((id) => !onlyIds || onlyIds.includes(id));
  if (ids.length === 0) return [];

  const userRows = await database.select().from(users).where(inArray(users.id, ids));
  const accountRows = await database
    .select({ userId: accounts.userId, providerId: accounts.providerId })
    .from(accounts)
    .where(inArray(accounts.userId, ids));
  const partnerRows = await database
    .select({ userId: partners.userId })
    .from(partners)
    .where(inArray(partners.userId, ids));
  const signInRows = await database
    .select({ actorId: auditLogs.actorId, last: max(auditLogs.createdAt) })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "auth.sign_in"), inArray(auditLogs.actorId, ids)))
    .groupBy(auditLogs.actorId);
  const sessionRows = await database
    .select({ userId: sessions.userId, last: max(sessions.createdAt) })
    .from(sessions)
    .where(inArray(sessions.userId, ids))
    .groupBy(sessions.userId);

  const lastBy = new Map<string, Date>();
  for (const r of signInRows) if (r.actorId && r.last) lastBy.set(r.actorId, r.last);
  for (const r of sessionRows) {
    const cur = lastBy.get(r.userId);
    if (r.last && (!cur || r.last > cur)) lastBy.set(r.userId, r.last);
  }
  const partnerSet = new Set(partnerRows.map((p) => p.userId));

  return userRows
    .map((u): AdminVerification => {
      const methods = new Set<"password" | "google">();
      for (const a of accountRows) {
        if (a.userId !== u.id) continue;
        if (a.providerId === "credential") methods.add("password");
        if (a.providerId === "google") methods.add("google");
      }
      const last = lastBy.get(u.id) ?? null;
      const missing: string[] = [];
      if (!u.emailVerified) missing.push("email is not verified");
      if (methods.size === 0) missing.push("no password set and no Google account linked");
      if (!last) missing.push("has never signed in");
      if (u.status !== "active") missing.push(`account is ${u.status}`);
      return {
        userId: u.id,
        name: u.name || u.email,
        email: u.email,
        role: roleBy.get(u.id) ?? "staff",
        status: u.status,
        emailVerified: u.emailVerified,
        signInMethods: [...methods],
        canSignIn: methods.size > 0,
        hasSignedIn: last !== null,
        lastSignInAt: last ? last.toISOString() : null,
        isPartner: partnerSet.has(u.id),
        verified: missing.length === 0,
        missing,
      };
    })
    .sort((a, b) => RANK[b.role] - RANK[a.role] || a.name.localeCompare(b.name));
}

/**
 * Refuses to remove a super admin unless at least two OTHER active super admins have a verified
 * login. The message names each one that is not ready and what is missing.
 */
export async function assertSafeSuperAdminRemoval(
  database: DbOrTx,
  targetId: string,
): Promise<void> {
  const isSuper = await database
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, targetId), eq(userRoles.roleKey, "super_admin")))
    .limit(1);
  if (isSuper.length === 0) return;

  const otherRows = await database
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(
      and(eq(userRoles.roleKey, "super_admin"), eq(users.status, "active"), ne(users.id, targetId)),
    );
  const others = await listAdminVerification(
    database,
    otherRows.map((r) => r.userId),
  );
  const ready = others.filter((o) => o.verified);
  if (ready.length >= MIN_OTHER_VERIFIED_SUPER_ADMINS) return;

  const parts = others
    .filter((o) => !o.verified)
    .map((o) => `${o.email} (${o.missing.join("; ")})`);
  const lacking = MIN_OTHER_VERIFIED_SUPER_ADMINS - ready.length;
  throw new AppError(
    ErrorCode.STATE_INVALID,
    `Cannot remove this super admin yet: ${MIN_OTHER_VERIFIED_SUPER_ADMINS} other active super admins must have a verified login ` +
      `(email verified, a password or Google account, and at least one successful sign-in). ` +
      `${ready.length} ready, ${lacking} more needed.` +
      (parts.length ? ` Not ready: ${parts.join(", ")}.` : " Invite another super admin first."),
  );
}
