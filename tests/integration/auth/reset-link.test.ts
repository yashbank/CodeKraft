import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildContext } from "@/lib/authz/context";
import { db } from "@/lib/db";
import { InMemoryRateLimitStore, setRateLimitStore } from "@/lib/rate-limit";
import { acceptToken, generateUserLink, previewToken } from "@/modules/auth/invites";
import { accounts, sessions, userTokens, users } from "../../../drizzle/schema/auth";
import { createAdmin, createSuperAdmin, createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const ctxOf = (id: string, roles: ("super_admin" | "admin" | "staff" | "customer")[]) =>
  buildContext({ user: { id }, session: { id: `s-${id}` }, roles });

describe("P10-02 admin reset link", () => {
  getTestDb();
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
    setRateLimitStore(new InMemoryRateLimitStore());
  });

  it("an admin can reset another admin; the link works once and kills every session", async () => {
    const actor = await createSuperAdmin();
    const target = await createAdmin();
    await db.insert(sessions).values([
      { userId: target.id, token: "a", expiresAt: new Date(Date.now() + 3600_000) },
      { userId: target.id, token: "b", expiresAt: new Date(Date.now() + 3600_000) },
    ]);
    await db.update(users).set({ mustChangePassword: true }).where(eq(users.id, target.id));
    const { token, purpose } = await generateUserLink(ctxOf(actor.id, ["super_admin"]), {
      userId: target.id,
    });
    expect(purpose).toBe("reset");
    const pw = "brand-new-admin-pass-9";
    await acceptToken({ token, password: pw });
    expect(await db.select().from(sessions).where(eq(sessions.userId, target.id))).toHaveLength(0);
    const [u] = await db.select().from(users).where(eq(users.id, target.id));
    expect(u?.mustChangePassword).toBe(false);
    await expect(acceptToken({ token, password: pw })).rejects.toThrow();
  });

  it("purpose=reset gives a 1 hour link even for a user with no password (e.g. Google-only)", async () => {
    const admin = await createAdmin();
    const cust = await createUser({ withAccount: false });
    expect(await db.select().from(accounts).where(eq(accounts.userId, cust.id))).toHaveLength(0);
    const { token, purpose } = await generateUserLink(ctxOf(admin.id, ["admin"]), {
      userId: cust.id,
      purpose: "reset",
    });
    expect(purpose).toBe("reset");
    const [row] = await db.select().from(userTokens);
    expect(row!.tokenHash).not.toBe(token);
    expect(row!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(3600_000);
    await acceptToken({ token, password: "google-user-new-pass-1" });
    expect(await db.select().from(accounts).where(eq(accounts.userId, cust.id))).toHaveLength(1);
  });

  it("regenerating replaces the previous reset link; admins cannot reset super admins; self is refused", async () => {
    const admin = await createAdmin();
    const sa = await createSuperAdmin();
    const cust = await createUser();
    const c = ctxOf(admin.id, ["admin"]);
    const first = await generateUserLink(c, { userId: cust.id });
    const second = await generateUserLink(c, { userId: cust.id });
    expect((await previewToken(first.token)).valid).toBe(false);
    expect((await previewToken(second.token)).valid).toBe(true);
    await expect(generateUserLink(c, { userId: sa.id })).rejects.toThrow(/super admin/i);
    await expect(generateUserLink(c, { userId: admin.id })).rejects.toThrow();
  });
});
