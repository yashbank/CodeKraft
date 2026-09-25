/**
 * P1.5 integration: single session (SA-02), idle timeouts (SA-03), argon2 (SA-01), suspended login
 * (FR-AUTH-12), TOTP forbidden for customers, phone-number endpoints 404 with the flag off,
 * admin host rejects non-admin accounts (docs/09 §3.1).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

process.env.APP_ENV = "local";
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_ADMIN_URL = "http://admin.localhost:3000";
process.env.ADMIN_HOST = "admin.localhost:3000";
process.env.EMAIL_TRANSPORT = "log";
process.env.FEATURE_PHONE_OTP = "false";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "";
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;

import { migrateTestDb } from "../../setup/migrate";

type Mods = {
  getDb: typeof import("@/lib/db").getDb;
  schema: typeof import("../../../drizzle/schema/auth");
  createAuth: typeof import("@/modules/auth/config").createAuth;
};
let m: Mods;
let n = 0;
const email = () => `user${Date.now()}-${n++}@example.com`;
const PW = "a-long-enough-passphrase-42";

async function signUpAndIn(
  auth: ReturnType<Mods["createAuth"]>,
  e: string,
  host = "http://localhost:3000",
) {
  await auth.api.signUpEmail({
    body: { email: e, password: PW, name: "T" },
    headers: new Headers({ host: new URL(host).host }),
  });
  const res = await auth.api.signInEmail({
    body: { email: e, password: PW },
    headers: new Headers({ host: new URL(host).host }),
    asResponse: true,
  });
  return res;
}

beforeAll(async () => {
  await migrateTestDb();
  const [{ getDb }, schema, { createAuth }] = await Promise.all([
    import("@/lib/db"),
    import("../../../drizzle/schema/auth"),
    import("@/modules/auth/config"),
  ]);
  m = { getDb, schema, createAuth };
});

describe("Better Auth (site host)", () => {
  it("stores argon2id hashes and keeps exactly one active session per user", async () => {
    const auth = m.createAuth("site");
    const e = email();
    const r1 = await signUpAndIn(auth, e);
    expect(r1.status).toBe(200);
    const db = m.getDb();
    const [u] = await db.select().from(m.schema.users).where(eq(m.schema.users.email, e));
    expect(u).toBeTruthy();
    const [acc] = await db
      .select()
      .from(m.schema.accounts)
      .where(eq(m.schema.accounts.userId, u!.id));
    expect(acc?.password?.startsWith("$argon2id$")).toBe(true);
    // second login replaces the first
    await auth.api.signInEmail({
      body: { email: e, password: PW },
      headers: new Headers({ host: "localhost:3000" }),
    });
    const rows = await db
      .select()
      .from(m.schema.sessions)
      .where(eq(m.schema.sessions.userId, u!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.host).toBe("site");
    // idle timeout 60 min on site host
    const life = (rows[0]!.expiresAt.getTime() - rows[0]!.createdAt.getTime()) / 1000;
    expect(life).toBeGreaterThan(3500);
    expect(life).toBeLessThan(3700);
  });

  it("refuses sign-in for suspended accounts", async () => {
    const auth = m.createAuth("site");
    const e = email();
    await signUpAndIn(auth, e);
    const db = m.getDb();
    await db.update(m.schema.users).set({ status: "suspended" }).where(eq(m.schema.users.email, e));
    const res = await auth.api.signInEmail({
      body: { email: e, password: PW },
      headers: new Headers({ host: "localhost:3000" }),
      asResponse: true,
    });
    expect(res.status).toBe(403);
    const [u] = await db.select().from(m.schema.users).where(eq(m.schema.users.email, e));
    expect(
      await db.select().from(m.schema.sessions).where(eq(m.schema.sessions.userId, u!.id)),
    ).toHaveLength(0);
  });

  it("forbids TOTP enrolment for customers and 404s phone-number endpoints when the flag is off", async () => {
    const auth = m.createAuth("site");
    const e = email();
    const res = await signUpAndIn(auth, e);
    const cookie = res.headers.get("set-cookie") ?? "";
    const enable = await auth.api.enableTwoFactor({
      body: { password: PW },
      headers: new Headers({ cookie, host: "localhost:3000" }),
      asResponse: true,
    });
    expect(enable.status).toBe(403);
    const r = await auth.handler(
      new Request("http://localhost:3000/api/auth/phone-number/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json", host: "localhost:3000" },
        body: JSON.stringify({ phoneNumber: "+919999999999" }),
      }),
    );
    expect(r.status).toBe(404);
  });

  it("rejects password containing the email local part", async () => {
    const auth = m.createAuth("site");
    const e = "policyuser@example.com";
    const res = await auth.api.signUpEmail({
      body: { email: e, password: "policyuser-is-here-123", name: "T" },
      headers: new Headers({ host: "localhost:3000" }),
      asResponse: true,
    });
    expect(res.status).toBe(400);
  });
});

describe("Better Auth (admin host)", () => {
  it("rejects accounts without an admin role, accepts admins with a 30-minute idle window", async () => {
    const admin = m.createAuth("admin");
    const e = email();
    const db = m.getDb();
    // create the account on the site instance
    await signUpAndIn(m.createAuth("site"), e);
    const [u] = await db.select().from(m.schema.users).where(eq(m.schema.users.email, e));
    const denied = await admin.api.signInEmail({
      body: { email: e, password: PW },
      headers: new Headers({ host: "admin.localhost:3000" }),
      asResponse: true,
    });
    expect(denied.status).toBe(401);
    await db.insert(m.schema.userRoles).values({ userId: u!.id, roleKey: "super_admin" });
    const ok = await admin.api.signInEmail({
      body: { email: e, password: PW },
      headers: new Headers({ host: "admin.localhost:3000" }),
      asResponse: true,
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toContain("ckadm.session_token");
    const rows = await db
      .select()
      .from(m.schema.sessions)
      .where(eq(m.schema.sessions.userId, u!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.host).toBe("admin");
    const life = (rows[0]!.expiresAt.getTime() - rows[0]!.createdAt.getTime()) / 1000;
    expect(life).toBeGreaterThan(1700);
    expect(life).toBeLessThan(1900);
  });
});
