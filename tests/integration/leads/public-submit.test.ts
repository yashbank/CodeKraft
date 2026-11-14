import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { anonymousContext } from "@/lib/authz/context";
import { getDb } from "@/lib/db";
import { issueFormToken } from "@/lib/form-guard";
import { InMemoryRateLimitStore, setRateLimitStore } from "@/lib/rate-limit";
import { submitPublicLead } from "@/modules/leads/public-submit";
import { leads } from "../../../drizzle/schema/leads";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";

const ctx = anonymousContext({ ip: "203.0.113.7" });
const body = (over: Record<string, unknown> = {}) => ({
  source: "inquiry_form",
  name: "Jane Doe",
  email: "jane@company.com",
  message: "Need a high-performance web platform",
  ...over,
});
const humanToken = () => issueFormToken(Date.now() - 10_000);
const count = async () => (await getDb().select().from(leads)).length;

describe("public lead entry: honeypot, time trap, rate limit", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
    setRateLimitStore(new InMemoryRateLimitStore());
  });

  it("a normal submission still creates a lead", async () => {
    const res = await submitPublicLead(body(), ctx, "203.0.113.7", {
      honeypot: "",
      token: humanToken(),
    });
    expect(res.ok).toBe(true);
    expect(await count()).toBe(1);
  });

  it("a stale client that still sends turnstileToken is accepted", async () => {
    const res = await submitPublicLead(body({ turnstileToken: "old" }), ctx, "203.0.113.7", {
      token: humanToken(),
    });
    expect(res.ok).toBe(true);
    expect(await count()).toBe(1);
  });

  it("filled honeypot: normal-looking success, nothing stored", async () => {
    const res = await submitPublicLead(body(), ctx, "203.0.113.7", {
      honeypot: "http://spam.example",
      token: humanToken(),
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.leadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await count()).toBe(0);
  });

  it("submitted too fast after render: success shape, nothing stored", async () => {
    const res = await submitPublicLead(body(), ctx, "203.0.113.7", {
      honeypot: "",
      token: issueFormToken(Date.now() - 300),
    });
    expect(res.ok).toBe(true);
    expect(await count()).toBe(0);
  });

  it("missing or forged token: success shape, nothing stored", async () => {
    for (const token of [undefined, null, "x.y", `${Date.now() - 10_000}.beef`]) {
      const res = await submitPublicLead(body(), ctx, "203.0.113.7", { token });
      expect(res.ok).toBe(true);
    }
    expect(await count()).toBe(0);
  });

  it("validation still applies to a human submission", async () => {
    const res = await submitPublicLead(body({ message: "short" }), ctx, "203.0.113.7", {
      token: humanToken(),
    });
    expect(res.ok).toBe(false);
    expect(await count()).toBe(0);
  });

  it("rate limits per IP: the 6th submission in an hour is refused", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await submitPublicLead(
        body({ email: `u${String(i)}@company.com` }),
        ctx,
        "198.51.100.1",
        {
          token: humanToken(),
        },
      );
      expect(r.ok).toBe(true);
    }
    const sixth = await submitPublicLead(body({ email: "u9@company.com" }), ctx, "198.51.100.1", {
      token: humanToken(),
    });
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.error.code).toBe("RATE_LIMITED");
    expect(await count()).toBe(5);
  });

  it("rate limits per email across different IPs", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await submitPublicLead(body(), ctx, `192.0.2.${String(i + 1)}`, {
        token: humanToken(),
      });
      expect(r.ok).toBe(true);
    }
    const sixth = await submitPublicLead(body(), ctx, "192.0.2.99", { token: humanToken() });
    expect(sixth.ok).toBe(false);
  });
});
