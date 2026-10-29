import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildContext } from "@/lib/authz/context";
import { db } from "@/lib/db";
import { getRateLimitStore, InMemoryRateLimitStore, setRateLimitStore } from "@/lib/rate-limit";
import { verifyPassword } from "@/modules/auth/hash";
import {
  acceptToken,
  completeForcedChange,
  createCustomerInvite,
  createCustomerWithTempPassword,
  generateUserLink,
  hashToken,
  previewToken,
  regenerateTempPassword,
} from "@/modules/auth/invites";
import { accounts, sessions, userTokens, users } from "../../../drizzle/schema/auth";
import { createAdmin, createSuperAdmin, createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const ctxOf = (id: string, roles: ("super_admin" | "admin" | "staff" | "customer")[]) =>
  buildContext({ user: { id }, session: { id: `s-${id}` }, roles });
const GOOD_PW = "a-long-enough-pass-1";

async function addSession(userId: string, token: string) {
  await db.insert(sessions).values({
    userId,
    token,
    expiresAt: new Date(Date.now() + 3600_000),
  });
}

describe("P10 invites, reset links, temp passwords", () => {
  getTestDb();
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
    setRateLimitStore(new InMemoryRateLimitStore());
  });

  it("stores only the SHA-256 of the token; invite expires in 7 days; single use creates the account", async () => {
    const admin = await createAdmin();
    const { token } = await createCustomerInvite(ctxOf(admin.id, ["admin"]), {
      email: "New@Example.com",
    });
    const rows = await db.select().from(userTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashToken(token));
    expect(rows[0]!.tokenHash).not.toContain(token);
    const days = (rows[0]!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);

    await acceptToken({ token, password: GOOD_PW, name: "Newbie" });
    const [u] = await db.select().from(users).where(eq(users.email, "new@example.com"));
    expect(u?.name).toBe("Newbie");
    await expect(acceptToken({ token, password: GOOD_PW })).rejects.toThrow(/invalid, expired/);
    expect(await previewToken(token)).toEqual({ valid: false, reason: "used" });
  });

  it("rejects expired tokens and regenerating invalidates the old link", async () => {
    const admin = await createAdmin();
    const c = ctxOf(admin.id, ["admin"]);
    const first = await createCustomerInvite(c, { email: "a@example.com" });
    const second = await createCustomerInvite(c, { email: "a@example.com" });
    expect(await previewToken(first.token)).toEqual({ valid: false, reason: "used" });
    expect((await previewToken(second.token)).valid).toBe(true);
    await db
      .update(userTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(userTokens.tokenHash, hashToken(second.token)));
    expect(await previewToken(second.token)).toEqual({ valid: false, reason: "expired" });
    await expect(acceptToken({ token: second.token, password: GOOD_PW })).rejects.toThrow();
  });

  it("reset link: 1 hour, sets password, revokes sessions, clears must_change_password", async () => {
    const admin = await createAdmin();
    const cust = await createUser({ email: "cust@example.com" });
    await db.update(users).set({ mustChangePassword: true }).where(eq(users.id, cust.id));
    await addSession(cust.id, "sess-1");
    const { token, purpose } = await generateUserLink(ctxOf(admin.id, ["admin"]), {
      userId: cust.id,
    });
    expect(purpose).toBe("reset");
    const [row] = await db.select().from(userTokens);
    const mins = (row!.expiresAt.getTime() - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(59);
    expect(mins).toBeLessThanOrEqual(60);

    await acceptToken({ token, password: GOOD_PW });
    expect(await db.select().from(sessions).where(eq(sessions.userId, cust.id))).toHaveLength(0);
    const [u] = await db.select().from(users).where(eq(users.id, cust.id));
    expect(u?.mustChangePassword).toBe(false);
    const [acc] = await db.select().from(accounts).where(eq(accounts.userId, cust.id));
    expect(await verifyPassword({ hash: acc!.password!, password: GOOD_PW })).toBe(true);
  });

  it("super admin accounts can only be reset by a super admin; roles are checked", async () => {
    const admin = await createAdmin();
    const sa = await createSuperAdmin();
    const sa2 = await createSuperAdmin();
    const staff = await createUser({ role: "staff" });
    const cust = await createUser();
    await expect(generateUserLink(ctxOf(admin.id, ["admin"]), { userId: sa.id })).rejects.toThrow(
      /super admin/i,
    );
    await expect(
      regenerateTempPassword(ctxOf(admin.id, ["admin"]), { userId: sa.id }),
    ).rejects.toThrow(/super admin/i);
    await expect(
      generateUserLink(ctxOf(sa2.id, ["super_admin"]), { userId: sa.id }),
    ).resolves.toBeDefined();
    // staff cannot manage admin-class users, nor create admin invites
    const staffCtx = ctxOf(staff.id, ["staff"]);
    await expect(generateUserLink(staffCtx, { userId: admin.id })).rejects.toThrow();
    // customer role cannot manage anyone
    await expect(
      generateUserLink(ctxOf(cust.id, ["customer"]), { userId: staff.id }),
    ).rejects.toThrow();
  });

  it("temp password: returned once, only an argon2 hash stored, flag set, sessions + old links revoked", async () => {
    const admin = await createAdmin();
    const c = ctxOf(admin.id, ["admin"]);
    const { userId, password } = await createCustomerWithTempPassword(c, {
      email: "t@example.com",
      name: "T",
    });
    const [acc] = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(acc!.password).not.toContain(password);
    expect(acc!.password!.startsWith("$argon2id$")).toBe(true);
    expect(password.length).toBeGreaterThanOrEqual(16);
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    expect(u?.mustChangePassword).toBe(true);
    // nothing in the DB contains the temp password in readable form
    const dump = JSON.stringify([
      await db.select().from(users),
      await db.select().from(accounts),
      await db.select().from(userTokens),
    ]);
    expect(dump).not.toContain(password);

    // regenerate: old password dies, new one differs
    await addSession(userId, "sess-t");
    const { token } = await generateUserLink(c, { userId });
    const again = await regenerateTempPassword(c, { userId });
    expect(again.password).not.toBe(password);
    const [acc2] = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(await verifyPassword({ hash: acc2!.password!, password })).toBe(false);
    expect(await verifyPassword({ hash: acc2!.password!, password: again.password })).toBe(true);
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
    expect((await previewToken(token)).valid).toBe(false);

    // forced change clears the flag and drops other sessions, keeps the current one
    await addSession(userId, "keep");
    await addSession(userId, "drop");
    await expect(
      completeForcedChange({
        userId,
        sessionToken: "keep",
        currentPassword: "wrong-wrong-wrong",
        newPassword: GOOD_PW,
      }),
    ).rejects.toThrow(/Incorrect/);
    await completeForcedChange({
      userId,
      sessionToken: "keep",
      currentPassword: again.password,
      newPassword: GOOD_PW,
    });
    const [after] = await db.select().from(users).where(eq(users.id, userId));
    expect(after?.mustChangePassword).toBe(false);
    const left = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(left.map((s) => s.token)).toEqual(["keep"]);
  });

  it("rate limits acceptance attempts per IP", async () => {
    expect(getRateLimitStore()).toBeInstanceOf(InMemoryRateLimitStore);
    let last: unknown;
    for (let i = 0; i < 11; i++)
      last = await acceptToken({ token: "x".repeat(43), password: GOOD_PW, ip: "1.2.3.4" }).catch(
        (e: unknown) => e,
      );
    expect((last as { code?: string }).code).toBe("RATE_LIMITED");
  });
});
