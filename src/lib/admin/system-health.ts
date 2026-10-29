/**
 * Admin dashboard "System health" checks. Every check has its own timeout + try/catch so one
 * failure becomes a `fail` row instead of emptying the widget; the list is never empty.
 */
import { sql } from "drizzle-orm";
import type { DashboardData } from "@/components/admin/types";
import { emailSenderProblem } from "@/lib/email/transport";

export type HealthCheck = DashboardData["systemHealth"][number];

/** Cron hits at least every 15 min; a day without any job run means the schedule is stalled. */
export const CRON_STALE_MS = 36 * 3_600_000;
export const CHECK_TIMEOUT_MS = 3_000;
const DB_SLOW_MS = 1_000;

export interface HealthDeps {
  /** Runs a read query, returns rows. */
  query: (q: ReturnType<typeof sql>) => Promise<Array<Record<string, unknown>>>;
  /** HEAD a probe key in the private bucket; a "not found" answer still proves reachability. */
  headProbe: () => Promise<unknown>;
  env: Parameters<typeof emailSenderProblem>[0];
  now?: () => Date;
  timeoutMs?: number;
}

type Result = Pick<HealthCheck, "status" | "detail">;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

const NOT_FOUND = /not.?found|no.?such|enoent|404/i;

export async function runHealthChecks(deps: HealthDeps): Promise<HealthCheck[]> {
  const now = deps.now ?? (() => new Date());
  const ms = deps.timeoutMs ?? CHECK_TIMEOUT_MS;

  const check = async (label: string, fn: () => Promise<Result>): Promise<HealthCheck> => {
    let r: Result;
    try {
      r = await withTimeout(fn(), ms);
    } catch (err) {
      r = { status: "fail", detail: err instanceof Error ? err.message : "check failed" };
    }
    return { label, ok: r.status !== "fail", checkedAt: now().toISOString(), ...r };
  };

  const checks = await Promise.all([
    check("Database", async () => {
      const t0 = Date.now();
      await deps.query(sql`select 1`);
      const took = Date.now() - t0;
      return { status: took > DB_SLOW_MS ? "warn" : "ok", detail: `${took} ms` };
    }),
    check("Storage", async () => {
      try {
        await deps.headProbe();
      } catch (err) {
        const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
        if (!NOT_FOUND.test(msg)) throw err;
      }
      return { status: "ok", detail: "bucket reachable" };
    }),
    check("Email", async () => {
      const problem = emailSenderProblem(deps.env);
      return problem ? { status: "warn", detail: problem } : { status: "ok", detail: "resend" };
    }),
    check("Cron", async () => {
      const [row] = await deps.query(sql`select max(started_at) as last from job_runs`);
      if (!row?.last) return { status: "warn", detail: "no runs yet" };
      const age = now().getTime() - new Date(row.last as string | Date).getTime();
      const hours = Math.round(age / 3_600_000);
      return age > CRON_STALE_MS
        ? { status: "warn", detail: `last run ${hours} h ago` }
        : { status: "ok", detail: hours < 1 ? "last run < 1 h ago" : `last run ${hours} h ago` };
    }),
    check("Recent errors", async () => {
      const [row] = await deps.query(sql`
        select
          (select count(*) from job_runs
            where status::text = 'error' and started_at > now() - interval '24 hours') as jobs,
          (select count(*) from email_outbox
            where last_error is not null and updated_at > now() - interval '24 hours') as emails`);
      const jobs = Number(row?.jobs ?? 0);
      const emails = Number(row?.emails ?? 0);
      return jobs + emails === 0
        ? { status: "ok", detail: "none in 24 h" }
        : { status: "warn", detail: `${jobs} failed jobs, ${emails} email errors (24 h)` };
    }),
  ]);

  return checks.length > 0
    ? checks
    : [
        {
          label: "Health checks unavailable",
          ok: false,
          status: "fail",
          detail: "no checks ran",
          checkedAt: now().toISOString(),
        },
      ];
}
