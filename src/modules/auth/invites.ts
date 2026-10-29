/**
 * Admin-issued single-use links and temporary passwords (P10).
 * Raw tokens exist only in the returned URL; the DB keeps SHA-256(token). A temporary password is
 * returned once and stored only as the normal argon2id hash (+ users.must_change_password).
 */
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";

import { audit } from "@/lib/audit-port";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { getDb, type Db } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertRateLimit, MINUTE_MS } from "@/lib/rate-limit";
import { accounts, sessions, userRoles, userTokens, users } from "../../../drizzle/schema/auth";
import { customerProfiles, partners } from "../../../drizzle/schema/users-ext";
import { hashPassword, verifyPassword } from "./hash";
import { passwordPolicyMessage, validatePassword } from "./password-policy";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;
export type TokenPurpose = "invite" | "reset";
const ADMIN_APP = ["super_admin", "admin", "staff"];

export const hashToken = (raw: string): string => createHash("sha256").update(raw).digest("hex");

const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
/** 20 chars from a 57-symbol alphabet (~117 bits); satisfies the 14-char admin minimum. */
export function generateTempPassword(): string {
  return Array.from({ length: 20 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join("");
}

/** Invalidate open tokens of this purpose for the email, then store a fresh one. Returns the raw token. */
export async function issueToken(
  db: Db,
  t: {
    purpose: TokenPurpose;
    email: string;
    userId?: string | null;
    role?: string | null;
    partnerName?: string | null;
    createdBy: string | null;
  },
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx
      .update(userTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(userTokens.email, t.email),
          eq(userTokens.purpose, t.purpose),
          isNull(userTokens.usedAt),
        ),
      );
    await tx.insert(userTokens).values({
      tokenHash: hashToken(raw),
      purpose: t.purpose,
      email: t.email,
      userId: t.userId ?? null,
      role: t.role ?? null,
      partnerName: t.partnerName ?? null,
      expiresAt: new Date(Date.now() + (t.purpose === "invite" ? INVITE_TTL_MS : RESET_TTL_MS)),
      createdBy: t.createdBy,
    });
  });
  return raw;
}

/** Super admins only by super admins; admin/staff need users.admin.manage; customers customers.reset_link. */
async function assertCanManage(ctx: RequestContext, db: Db, userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.status === "deleted") throw new AppError(ErrorCode.NOT_FOUND, "User not found");
  const roles = (
    await db.select({ r: userRoles.roleKey }).from(userRoles).where(eq(userRoles.userId, userId))
  ).map((x) => x.r as string);
  if (roles.includes("super_admin")) {
    if (!ctx.roles.includes("super_admin"))
      throw new AppError(ErrorCode.FORBIDDEN, "Only a super admin can manage a super admin.");
    assertPermission(ctx, "users.admin.manage");
  } else if (roles.some((r) => ADMIN_APP.includes(r))) assertPermission(ctx, "users.admin.manage");
  else assertPermission(ctx, "customers.reset_link");
  if (u.id === ctx.userId)
    throw new AppError(ErrorCode.FORBIDDEN, "Use account settings for your own password.");
  return { user: u, roles };
}

export async function createCustomerInvite(
  ctx: RequestContext,
  input: { email: string },
  db: Db = getDb(),
): Promise<{ token: string; expiresAt: Date }> {
  assertPermission(ctx, "customers.reset_link");
  const email = input.email.trim().toLowerCase();
  const [dup] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (dup) throw new AppError(ErrorCode.CONFLICT, "A user with this email already exists.");
  const token = await issueToken(db, {
    purpose: "invite",
    email,
    role: "customer",
    createdBy: ctx.userId,
  });
  await audit({
    action: "auth.invite.created",
    actorId: ctx.userId,
    meta: { email, role: "customer" },
  });
  return { token, expiresAt: new Date(Date.now() + INVITE_TTL_MS) };
}

/** Link for an existing user: 'invite' while they have no password yet, otherwise 'reset'. Regenerating revokes the previous link. */
export async function generateUserLink(
  ctx: RequestContext,
  input: { userId: string },
  db: Db = getDb(),
): Promise<{ token: string; purpose: TokenPurpose; expiresAt: Date }> {
  const { user, roles } = await assertCanManage(ctx, db, input.userId);
  const [cred] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
    .limit(1);
  const purpose: TokenPurpose = cred ? "reset" : "invite";
  const token = await issueToken(db, {
    purpose,
    email: String(user.email).toLowerCase(),
    userId: user.id,
    role: roles[0] ?? null,
    createdBy: ctx.userId,
  });
  await audit({
    action: `auth.${purpose}.link_generated`,
    actorId: ctx.userId,
    subjectType: "user",
    subjectId: user.id,
  });
  const ttl = purpose === "invite" ? INVITE_TTL_MS : RESET_TTL_MS;
  return { token, purpose, expiresAt: new Date(Date.now() + ttl) };
}

async function setTemp(db: Db, userId: string, email: string): Promise<string> {
  const password = generateTempPassword();
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const [cred] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
      .limit(1);
    if (cred)
      await tx
        .update(accounts)
        .set({ password: hash, updatedAt: new Date() })
        .where(eq(accounts.id, cred.id));
    else
      await tx
        .insert(accounts)
        .values({ userId, accountId: userId, providerId: "credential", password: hash });
    await tx
      .update(users)
      .set({ mustChangePassword: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx
      .update(userTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(userTokens.email, email), isNull(userTokens.usedAt)));
  });
  return password;
}

/** Replace a user's password with a new temporary one (old password, sessions and open links die). Shown once. */
export async function regenerateTempPassword(
  ctx: RequestContext,
  input: { userId: string },
  db: Db = getDb(),
): Promise<{ password: string }> {
  const { user } = await assertCanManage(ctx, db, input.userId);
  const password = await setTemp(db, user.id, String(user.email).toLowerCase());
  await audit({
    action: "auth.temp_password.issued",
    actorId: ctx.userId,
    subjectType: "user",
    subjectId: user.id,
  });
  return { password };
}

/** New customer with a temporary password. Admin-class accounts go through the invite approval instead. */
export async function createCustomerWithTempPassword(
  ctx: RequestContext,
  input: { email: string; name: string },
  db: Db = getDb(),
): Promise<{ userId: string; email: string; password: string }> {
  assertPermission(ctx, "customers.reset_link");
  const email = input.email.trim().toLowerCase();
  const [dup] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (dup) throw new AppError(ErrorCode.CONFLICT, "A user with this email already exists.");
  const userId = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ email, name: input.name, status: "active" })
      .returning({ id: users.id });
    if (!u) throw new AppError(ErrorCode.INTERNAL, "Failed to create user");
    await tx.insert(userRoles).values({ userId: u.id, roleKey: "customer" });
    await tx.insert(customerProfiles).values({ userId: u.id });
    return u.id;
  });
  const password = await setTemp(db, userId, email);
  await audit({
    action: "auth.temp_password.issued",
    actorId: ctx.userId,
    subjectType: "user",
    subjectId: userId,
  });
  return { userId, email, password };
}

export type TokenPreview =
  | { valid: true; purpose: TokenPurpose; email: string; needsName: boolean }
  | { valid: false; reason: "invalid" | "expired" | "used" };

export async function previewToken(raw: string, db: Db = getDb()): Promise<TokenPreview> {
  const [t] = await db
    .select()
    .from(userTokens)
    .where(eq(userTokens.tokenHash, hashToken(raw)))
    .limit(1);
  if (!t) return { valid: false, reason: "invalid" };
  if (t.usedAt) return { valid: false, reason: "used" };
  if (t.expiresAt <= new Date()) return { valid: false, reason: "expired" };
  return {
    valid: true,
    purpose: t.purpose as TokenPurpose,
    email: String(t.email),
    needsName: !t.userId,
  };
}

/** Consume a token and set the password. Single use is enforced by the conditional UPDATE. */
export async function acceptToken(
  input: { token: string; password: string; name?: string; ip?: string | null },
  db: Db = getDb(),
): Promise<{ purpose: TokenPurpose; email: string }> {
  await assertRateLimit(`invite-accept:${input.ip ?? "unknown"}`, 10, 15 * MINUTE_MS);
  const gone = () =>
    new AppError(ErrorCode.NOT_FOUND, "This link is invalid, expired or already used.");
  const [t] = await db
    .select()
    .from(userTokens)
    .where(eq(userTokens.tokenHash, hashToken(input.token)))
    .limit(1);
  if (!t || t.usedAt || t.expiresAt <= new Date()) throw gone();
  const email = String(t.email);
  const isAdmin = ADMIN_APP.includes(t.role ?? "");
  const bad = validatePassword(input.password, { email, isAdmin });
  if (bad) throw new AppError(ErrorCode.VALIDATION, passwordPolicyMessage(bad, { isAdmin }));
  const pwHash = await hashPassword(input.password);

  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(userTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(userTokens.id, t.id),
          isNull(userTokens.usedAt),
          gt(userTokens.expiresAt, new Date()),
        ),
      )
      .returning({ id: userTokens.id });
    if (!claimed) throw gone();

    let userId = t.userId;
    if (!userId) {
      const [dup] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (dup) throw new AppError(ErrorCode.CONFLICT, "An account with this email already exists.");
      const [u] = await tx
        .insert(users)
        .values({
          email,
          name: input.name?.trim() || (email.split("@")[0] ?? email),
          status: "active",
        })
        .returning({ id: users.id });
      if (!u) throw new AppError(ErrorCode.INTERNAL, "Failed to create user");
      userId = u.id;
      await tx.insert(userRoles).values({ userId, roleKey: "customer" });
      await tx.insert(customerProfiles).values({ userId });
      if (t.partnerName) await tx.insert(partners).values({ userId, displayName: t.partnerName });
    }
    const [cred] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
      .limit(1);
    if (cred)
      await tx
        .update(accounts)
        .set({ password: pwHash, updatedAt: new Date() })
        .where(eq(accounts.id, cred.id));
    else
      await tx
        .insert(accounts)
        .values({ userId, accountId: userId, providerId: "credential", password: pwHash });
    await tx
      .update(users)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, userId));
    // A reset ends every session; an invite has none, so the same delete is harmless.
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
  await audit({
    action: `auth.${t.purpose}.accepted`,
    actorId: t.userId ?? null,
    meta: { email },
  });
  return { purpose: t.purpose as TokenPurpose, email };
}

/** First-login forced change: verifies the temp password, sets the new one, clears the flag, drops other sessions. */
export async function completeForcedChange(
  input: { userId: string; sessionToken: string; currentPassword: string; newPassword: string },
  db: Db = getDb(),
): Promise<void> {
  const [u] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!u) throw new AppError(ErrorCode.UNAUTHENTICATED);
  const roles = (
    await db.select({ r: userRoles.roleKey }).from(userRoles).where(eq(userRoles.userId, u.id))
  ).map((x) => x.r as string);
  const isAdmin = roles.some((r) => ADMIN_APP.includes(r));
  const [cred] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, u.id), eq(accounts.providerId, "credential")))
    .limit(1);
  if (
    !cred?.password ||
    !(await verifyPassword({ hash: cred.password, password: input.currentPassword }))
  )
    throw new AppError(ErrorCode.UNAUTHENTICATED, "Incorrect current password");
  if (input.currentPassword === input.newPassword)
    throw new AppError(ErrorCode.VALIDATION, "New password must differ from the temporary one.");
  const bad = validatePassword(input.newPassword, { email: String(u.email), isAdmin });
  if (bad) throw new AppError(ErrorCode.VALIDATION, passwordPolicyMessage(bad, { isAdmin }));
  const hash = await hashPassword(input.newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(accounts)
      .set({ password: hash, updatedAt: new Date() })
      .where(eq(accounts.id, cred.id));
    await tx
      .update(users)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, u.id));
    await tx
      .delete(sessions)
      .where(and(eq(sessions.userId, u.id), ne(sessions.token, input.sessionToken)));
  });
  await audit({ action: "auth.password_changed", actorId: u.id, meta: { forced: true } });
}
