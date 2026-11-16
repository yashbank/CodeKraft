/**
 * Cross-host handoff token: single use (replay rejected), expires within 60 s, stored hashed.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

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

const PW = "a-long-enough-passphrase-42";
const SITE_HOST = "localhost:3000";
let createAuth: typeof import("@/modules/auth/config").createAuth;
let getDb: typeof import("@/lib/db").getDb;

async function mint() {
  const auth = createAuth("site");
  const e = `handoff${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await auth.api.signUpEmail({
    body: { email: e, password: PW, name: "H" },
    headers: new Headers({ host: SITE_HOST }),
  });
  const res = await auth.api.signInEmail({
    body: { email: e, password: PW },
    headers: new Headers({ host: SITE_HOST }),
    asResponse: true,
  });
  const cookie = (res.headers.get("set-cookie") ?? "")
    .split(/,(?=\s*[^;,]+=)/)
    .map((c) => c.split(";")[0]!.trim())
    .join("; ");
  const { token } = await auth.api.generateOneTimeToken({
    headers: new Headers({ cookie, host: SITE_HOST }),
  });
  return { auth, token };
}

function verify(auth: ReturnType<typeof createAuth>, token: string) {
  return auth.api.verifyOneTimeToken({
    body: { token },
    headers: new Headers({ host: SITE_HOST }),
    asResponse: true,
  });
}

beforeAll(async () => {
  await migrateTestDb();
  ({ createAuth } = await import("@/modules/auth/config"));
  ({ getDb } = await import("@/lib/db"));
});

afterEach(() => vi.useRealTimers());

describe("handoff one-time token", () => {
  it("verifies once, then rejects a replay", async () => {
    const { auth, token } = await mint();
    const first = await verify(auth, token);
    expect(first.status).toBe(200);
    const replay = await verify(auth, token);
    expect(replay.status).toBe(400);
  });

  it("rejects an unknown token", async () => {
    const { auth } = await mint();
    expect((await verify(auth, "not-a-real-token")).status).toBe(400);
  });

  it("rejects the token after 60 seconds", async () => {
    const { auth, token } = await mint();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61_000);
    expect((await verify(auth, token)).status).toBe(400);
  });

  it("still accepts the token inside the 60 second window", async () => {
    const { auth, token } = await mint();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 30_000);
    expect((await verify(auth, token)).status).toBe(200);
  });

  it("does not store the raw token", async () => {
    const { token } = await mint();
    const rows = await getDb().execute(
      sql`select 1 from verifications where identifier = ${`one-time-token:${token}`}`,
    );
    expect(rows).toHaveLength(0);
  });
});
