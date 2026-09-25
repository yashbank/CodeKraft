import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  InMemoryRateLimitStore,
  MINUTE_MS,
  RATE_LIMIT_CLASSES,
  assertRateLimit,
  checkClass,
  getRateLimitStore,
  rateLimit,
  rateLimitKey,
  setRateLimitStore,
} from "@/lib/rate-limit";

const T0 = new Date("2026-09-25T10:00:00Z").getTime();

describe("InMemoryRateLimitStore", () => {
  let store: InMemoryRateLimitStore;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    store = new InMemoryRateLimitStore();
    setRateLimitStore(store);
  });
  afterEach(() => {
    vi.useRealTimers();
    setRateLimitStore(new InMemoryRateLimitStore());
  });

  it("counts hits until the limit, then blocks with remaining 0 and the same resetAt", async () => {
    const r1 = await rateLimit("k", 3, MINUTE_MS);
    expect(r1).toEqual({ allowed: true, remaining: 2, resetAt: T0 + MINUTE_MS });
    expect((await rateLimit("k", 3, MINUTE_MS)).remaining).toBe(1);
    expect((await rateLimit("k", 3, MINUTE_MS)).remaining).toBe(0);
    const blocked = await rateLimit("k", 3, MINUTE_MS);
    expect(blocked).toEqual({ allowed: false, remaining: 0, resetAt: T0 + MINUTE_MS });
    // blocked hits do not extend the window
    expect((await rateLimit("k", 3, MINUTE_MS)).resetAt).toBe(T0 + MINUTE_MS);
  });

  it("rolls the window over once resetAt is reached", async () => {
    for (let i = 0; i < 3; i += 1) await rateLimit("k", 3, MINUTE_MS);
    vi.setSystemTime(T0 + MINUTE_MS - 1);
    expect((await rateLimit("k", 3, MINUTE_MS)).allowed).toBe(false);
    vi.setSystemTime(T0 + MINUTE_MS);
    const fresh = await rateLimit("k", 3, MINUTE_MS);
    expect(fresh).toEqual({ allowed: true, remaining: 2, resetAt: T0 + 2 * MINUTE_MS });
  });

  it("keeps keys independent and prunes expired buckets", async () => {
    await rateLimit("a", 1, MINUTE_MS);
    await rateLimit("b", 1, 5 * MINUTE_MS);
    expect((await rateLimit("a", 1, MINUTE_MS)).allowed).toBe(false);
    expect(store.size).toBe(2);
    vi.setSystemTime(T0 + MINUTE_MS);
    store.prune();
    expect(store.size).toBe(1);
    store.clear();
    expect(store.size).toBe(0);
  });

  it("validates limit and window", () => {
    expect(() => store.hit("k", 0, 10)).toThrow(/limit must be/);
    expect(() => store.hit("k", 1, 0)).toThrow(/windowMs must be/);
  });

  it("accepts an injected clock", async () => {
    let now = 1000;
    const clocked = new InMemoryRateLimitStore(() => now);
    expect((await clocked.hit("k", 1, 100)).resetAt).toBe(1100);
    now = 1100;
    expect((await clocked.hit("k", 1, 100)).allowed).toBe(true);
  });

  it("assertRateLimit throws RATE_LIMITED with retryAfterMs when blocked", async () => {
    await assertRateLimit("k", 1, MINUTE_MS);
    vi.setSystemTime(T0 + 15_000);
    const err = await assertRateLimit("k", 1, MINUTE_MS).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe(ErrorCode.RATE_LIMITED);
    expect((err as AppError).retryAfterMs).toBe(MINUTE_MS - 15_000);
    expect((err as AppError).httpStatus).toBe(429);
  });

  it("store setter/getter", () => {
    expect(getRateLimitStore()).toBe(store);
  });
});

describe("checkClass", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    setRateLimitStore(new InMemoryRateLimitStore());
  });
  afterEach(() => {
    vi.useRealTimers();
    setRateLimitStore(new InMemoryRateLimitStore());
  });

  it("builds the shared key format", () => {
    expect(rateLimitKey("login", "ip", "1.2.3.4")).toBe("login:ip:1.2.3.4");
  });

  it("applies every rule with a subject and returns the strictest result", async () => {
    // login: ip 10/15 min, account 5/15 min with 15 min lock
    const first = await checkClass("login", { ip: "1.2.3.4", account: "u1" });
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(4); // account rule is the tighter one
    for (let i = 0; i < 4; i += 1) await checkClass("login", { ip: "1.2.3.4", account: "u1" });
    const blocked = await checkClass("login", { ip: "1.2.3.4", account: "u1" });
    expect(blocked.allowed).toBe(false);
    // the ip rule was hit on every call (6 of 10) even while the account rule blocked
    expect((await checkClass("login", { ip: "1.2.3.4" })).remaining).toBe(3);
  });

  it("skips rules without a subject and refuses when none applies", async () => {
    expect((await checkClass("signup", { ip: "9.9.9.9" })).remaining).toBe(4);
    await expect(checkClass("signup", { user: "u" })).rejects.toThrow(/no subject supplied/);
  });

  it("uses the lock duration as the window when longer", async () => {
    const rule = RATE_LIMIT_CLASSES.login[1];
    if (rule === undefined) throw new Error("login account rule missing");
    expect(rule.lockMs).toBe(15 * MINUTE_MS);
    const r = await checkClass("login", { account: "u2" });
    expect(r.resetAt).toBe(T0 + Math.max(rule.windowMs, rule.lockMs ?? 0));
  });
});
