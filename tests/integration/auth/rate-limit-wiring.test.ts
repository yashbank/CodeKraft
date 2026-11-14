/**
 * SEC p19-4 #4: login / signup / reset / otp rate classes are enforced on real HTTP requests
 * (Better Auth before-hook), per IP and per account email; server-side API calls are exempt.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

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
delete process.env.AUTH_RATE_LIMIT_SCALE;

import { InMemoryRateLimitStore, setRateLimitStore, type RateLimitStore } from "@/lib/rate-limit";
import { migrateTestDb } from "../../setup/migrate";

let createAuth: typeof import("@/modules/auth/config").createAuth;

beforeAll(async () => {
  await migrateTestDb();
  ({ createAuth } = await import("@/modules/auth/config"));
});
beforeEach(() => setRateLimitStore(new InMemoryRateLimitStore()));

function post(path: string, body: unknown, ip: string) {
  return createAuth("site", { phoneOtp: true }).handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }),
  );
}

class RecordingStore implements RateLimitStore {
  keys: string[] = [];
  limits: Record<string, number> = {};
  constructor(private deny = false) {}
  hit(key: string, limit: number, windowMs: number) {
    this.keys.push(key);
    this.limits[key] = limit;
    return Promise.resolve({
      allowed: !this.deny,
      remaining: this.deny ? 0 : 1,
      resetAt: Date.now() + windowMs,
    });
  }
}

describe("auth rate limits on real requests", () => {
  it("login: counts per IP and per account email, scaled above the canonical limits", async () => {
    const store = new RecordingStore();
    setRateLimitStore(store);
    await post(
      "/sign-in/email",
      { email: "Victim@Example.com", password: "wrong-password-123456" },
      "10.0.0.1",
    );
    expect(store.keys).toContain("login:ip:10.0.0.1");
    expect(store.keys).toContain("login:account:victim@example.com");
    expect(store.limits["login:account:victim@example.com"]).toBeGreaterThanOrEqual(5);
    expect(store.limits["login:ip:10.0.0.1"]).toBeGreaterThanOrEqual(10);
  });

  it.each([
    ["/sign-in/email", { email: "a@example.com", password: "wrong-password-123456" }, "login"],
    ["/sign-up/email", { email: "a@example.com", password: "x".repeat(14), name: "N" }, "signup"],
    ["/request-password-reset", { email: "a@example.com" }, "reset"],
    ["/phone-number/send-otp", { phoneNumber: "+15555550100" }, "otp"],
  ])(
    "%s answers 429 when the %s class is exhausted, without running the endpoint",
    async (path, body, cls) => {
      const store = new RecordingStore(true);
      setRateLimitStore(store);
      const res = await post(path, body, "10.2.2.2");
      expect(res.status).toBe(429);
      expect(store.keys.some((k) => k.startsWith(`${cls}:`))).toBe(true);
    },
  );

  it("an account hammered from many IPs is blocked by the account key", async () => {
    setRateLimitStore(new InMemoryRateLimitStore());
    const codes: number[] = [];
    for (let i = 0; i < 30; i++) {
      codes.push(
        (
          await post(
            "/sign-in/email",
            { email: "victim@example.com", password: "wrong-password-123456" },
            `10.0.0.${i}`,
          )
        ).status,
      );
    }
    expect(codes[0]).not.toBe(429);
    expect(codes).toContain(429);
    const other = await post(
      "/sign-in/email",
      { email: "someone-else@example.com", password: "wrong-password-123456" },
      "10.9.9.9",
    );
    expect(other.status).not.toBe(429);
  });

  it("does not limit server-side API calls (seed, tests): no request object", async () => {
    const store = new RecordingStore(true);
    setRateLimitStore(store);
    const auth = createAuth("site");
    await auth.api
      .signInEmail({ body: { email: "nobody@example.com", password: "x".repeat(14) } })
      .catch(() => undefined);
    expect(store.keys).toHaveLength(0);
  });
});
