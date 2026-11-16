/**
 * Postgres-backed rate limit store (table `rate_limit_buckets`, docs/09 §7).
 *
 * One atomic `INSERT ... ON CONFLICT DO UPDATE` per hit, so the limit holds across serverless
 * instances and cold starts. Fixed window anchored at the first hit, timed by the DB clock.
 * Fail-open: any DB error or timeout is logged and the hit is served by the in-memory fallback,
 * so a database problem never blocks logins or forms.
 */
import { sql } from "drizzle-orm";
import { moduleLogger } from "./logger";
import { InMemoryRateLimitStore, type RateLimitResult, type RateLimitStore } from "./rate-limit";

const DB_TIMEOUT_MS = 2_000;

export type RateLimitExec = (
  key: string,
  windowMs: number,
) => Promise<{ count: number; resetAtMs: number }>;

/** Default executor: runs the upsert on the pooled app client. */
async function defaultExec(key: string, windowMs: number) {
  const { getDb } = await import("./db");
  const rows = (await getDb().execute(sql`
    INSERT INTO rate_limit_buckets AS b ("key", "count", "window_start", "expires_at")
    VALUES (${key}, 1, now(), now() + (${windowMs}::double precision * interval '1 millisecond'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN b."expires_at" <= now() THEN 1 ELSE b."count" + 1 END,
      "window_start" = CASE WHEN b."expires_at" <= now() THEN now() ELSE b."window_start" END,
      "expires_at" = CASE WHEN b."expires_at" <= now()
        THEN now() + (${windowMs}::double precision * interval '1 millisecond')
        ELSE b."expires_at" END
    RETURNING "count"::int AS count, (extract(epoch from "expires_at") * 1000)::float8 AS reset_ms
  `)) as unknown as { count: number; reset_ms: number }[];
  const row = rows[0];
  if (row === undefined) throw new Error("rate_limit upsert returned no row");
  return { count: Number(row.count), resetAtMs: Number(row.reset_ms) };
}

export class PostgresRateLimitStore implements RateLimitStore {
  constructor(
    private readonly exec: RateLimitExec = defaultExec,
    private readonly fallback: RateLimitStore = new InMemoryRateLimitStore(),
    private readonly timeoutMs: number = DB_TIMEOUT_MS,
  ) {}

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("limit must be ≥ 1");
    if (!Number.isSafeInteger(windowMs) || windowMs < 1)
      throw new RangeError("windowMs must be ≥ 1");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { count, resetAtMs } = await Promise.race([
        this.exec(key, windowMs),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("rate limit db timeout")), this.timeoutMs);
        }),
      ]);
      const allowed = count <= limit;
      return { allowed, remaining: allowed ? limit - count : 0, resetAt: resetAtMs };
    } catch (err) {
      moduleLogger("rate-limit").warn(
        { err: err instanceof Error ? err.message : String(err) },
        "rate limit store unavailable; failing open on in-memory fallback",
      );
      return this.fallback.hit(key, limit, windowMs);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
