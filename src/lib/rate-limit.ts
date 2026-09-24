/**
 * Rate limiting port — docs/06 §1.7 (D-1204), docs/09 §7.
 *
 * `RateLimitStore` is the port: `InMemoryRateLimitStore` here (single container / tests), the
 * Postgres `rate_limit_buckets` store arrives in P2, enforcement in P9. Windows are fixed
 * (anchored at the first hit); the stricter of several rules applies (`checkClass`).
 */
import { AppError, ErrorCode } from "./errors";

export interface RateLimitResult {
  allowed: boolean;
  /** Hits left in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms at which the window resets. */
  resetAt: number;
}

export interface RateLimitStore {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("limit must be ≥ 1");
    if (!Number.isSafeInteger(windowMs) || windowMs < 1)
      throw new RangeError("windowMs must be ≥ 1");
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (bucket === undefined || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    if (bucket.count >= limit) {
      return Promise.resolve({ allowed: false, remaining: 0, resetAt: bucket.resetAt });
    }
    bucket.count += 1;
    return Promise.resolve({
      allowed: true,
      remaining: limit - bucket.count,
      resetAt: bucket.resetAt,
    });
  }

  /** Drop expired buckets (call from a timer in long-lived processes). */
  prune(): void {
    const now = this.now();
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
  }

  clear(): void {
    this.buckets.clear();
  }

  get size(): number {
    return this.buckets.size;
  }
}

let store: RateLimitStore = new InMemoryRateLimitStore();

export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

export function getRateLimitStore(): RateLimitStore {
  return store;
}

/** Record one hit against `key` and report whether it is within `limit` per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  return store.hit(key, limit, windowMs);
}

/** Like `rateLimit` but throws `RATE_LIMITED` with `retryAfterMs` when blocked. */
export async function assertRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: () => number = () => Date.now(),
): Promise<RateLimitResult> {
  const result = await rateLimit(key, limit, windowMs);
  if (!result.allowed) {
    throw new AppError(ErrorCode.RATE_LIMITED, undefined, {
      retryAfterMs: Math.max(0, result.resetAt - now()),
    });
  }
  return result;
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export type RateLimitScope =
  "ip" | "user" | "account" | "email" | "phone" | "session" | "anon" | "job";

export interface RateLimitRule {
  scope: RateLimitScope;
  limit: number;
  windowMs: number;
  /** Lockout applied once the limit is hit (login per account). */
  lockMs?: number;
  /** `limit` is a concurrency cap rather than a window count (cron). */
  concurrent?: true;
  note?: string;
}

/** Canonical classes and values from docs/06 §1.7 (tunable in `site_settings` later). */
export const RATE_LIMIT_CLASSES = Object.freeze({
  login: [
    { scope: "ip", limit: 10, windowMs: 15 * MINUTE_MS },
    { scope: "account", limit: 5, windowMs: 15 * MINUTE_MS, lockMs: 15 * MINUTE_MS },
  ],
  totp: [{ scope: "session", limit: 5, windowMs: 5 * MINUTE_MS }],
  signup: [{ scope: "ip", limit: 5, windowMs: HOUR_MS }],
  verify_resend: [{ scope: "email", limit: 3, windowMs: HOUR_MS }],
  reset: [
    { scope: "email", limit: 3, windowMs: HOUR_MS },
    { scope: "ip", limit: 10, windowMs: HOUR_MS },
  ],
  otp: [
    { scope: "phone", limit: 5, windowMs: HOUR_MS },
    { scope: "ip", limit: 10, windowMs: HOUR_MS },
  ],
  public_form: [{ scope: "ip", limit: 5, windowMs: HOUR_MS, note: "plus Turnstile" }],
  chat: [
    {
      scope: "user",
      limit: 30,
      windowMs: 10 * MINUTE_MS,
      note: "daily caps come from site_settings (D-708)",
    },
  ],
  download: [{ scope: "user", limit: 20, windowMs: HOUR_MS, note: "cap per entitlement (BR-15)" }],
  key_reveal: [{ scope: "user", limit: 10, windowMs: HOUR_MS }],
  checkout: [{ scope: "user", limit: 10, windowMs: DAY_MS }],
  coupon: [{ scope: "user", limit: 10, windowMs: 10 * MINUTE_MS }],
  quote_lookup: [{ scope: "ip", limit: 10, windowMs: HOUR_MS }],
  upload: [{ scope: "user", limit: 30, windowMs: HOUR_MS }],
  poll: [{ scope: "session", limit: 30, windowMs: MINUTE_MS }],
  admin: [{ scope: "user", limit: 300, windowMs: MINUTE_MS }],
  analytics: [
    { scope: "anon", limit: 120, windowMs: MINUTE_MS },
    { scope: "user", limit: 120, windowMs: MINUTE_MS },
  ],
  cron: [{ scope: "job", limit: 1, windowMs: MINUTE_MS, concurrent: true }],
} satisfies Record<string, readonly RateLimitRule[]>);

export type RateLimitClass = keyof typeof RATE_LIMIT_CLASSES;

/** Key format shared by all stores: `<class>:<scope>:<subject>`. */
export function rateLimitKey(cls: RateLimitClass, scope: RateLimitScope, subject: string): string {
  return `${cls}:${scope}:${subject}`;
}

/**
 * Apply every rule of a class for which a subject is supplied (e.g. `{ ip, account }`) and
 * return the strictest outcome; a blocked result wins, otherwise the lowest `remaining`.
 * Rules whose scope has no subject are skipped, so callers pass what they know.
 */
export async function checkClass(
  cls: RateLimitClass,
  subjects: Partial<Record<RateLimitScope, string>>,
): Promise<RateLimitResult> {
  const rules: readonly RateLimitRule[] = RATE_LIMIT_CLASSES[cls];
  let strictest: RateLimitResult | undefined;
  for (const rule of rules) {
    const subject = subjects[rule.scope];
    if (subject === undefined) continue;
    const windowMs =
      rule.lockMs === undefined ? rule.windowMs : Math.max(rule.windowMs, rule.lockMs);
    const result = await store.hit(rateLimitKey(cls, rule.scope, subject), rule.limit, windowMs);
    if (
      strictest === undefined ||
      (!result.allowed && strictest.allowed) ||
      (result.allowed === strictest.allowed && result.remaining < strictest.remaining)
    ) {
      strictest = result;
    }
  }
  if (strictest === undefined)
    throw new RangeError(`no subject supplied for rate-limit class ${cls}`);
  return strictest;
}
