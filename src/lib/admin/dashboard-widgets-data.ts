/**
 * Real data sources for the dashboard widgets that used to be hard-coded empty (service
 * checklists, revocation tasks, pipeline funnel, conversion rate, visits, chatbot usage,
 * customers, system health). Server-only; each loader returns the exact `DashboardData` slice and
 * never throws (a failed query becomes the empty state plus a server log line).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { DashboardData, QueueItem } from "@/components/admin/types";

const n = (v: unknown) => Number(v ?? 0);
const NO_DATA = "No data yet";

export const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90, fy: 366 } as const;

async function safe<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[dashboard] ${label} failed`, err);
    return fallback;
  }
}

export function deltaText(current: number, previous: number): string {
  if (current === 0 && previous === 0) return NO_DATA;
  const diff = current - previous;
  if (diff === 0) return "No change vs previous period";
  return `${diff > 0 ? "+" : "-"}${Math.abs(diff)} vs previous period`;
}

export const loadServiceChecklists = (): Promise<QueueItem[]> =>
  safe("serviceChecklists", [], async () => {
    const rows = await db.execute<{
      id: string;
      name: string;
      total: string;
      done: string;
    }>(sql`
      select e.id, p.name, count(sp.id) as total, count(sp.done_at) as done
      from service_progress sp
      join entitlements e on e.id = sp.entitlement_id
      join products p on p.id = e.product_id
      where e.status in ('pending', 'active')
      group by e.id, p.name
      having count(sp.done_at) < count(sp.id)
      order by min(sp.created_at) asc
      limit 10`);
    return [...rows].map((r) => ({
      label: r.name,
      meta: `${n(r.done)} of ${n(r.total)} steps done`,
      href: `/entitlements/${r.id}`,
      progress: n(r.total) > 0 ? n(r.done) / n(r.total) : 0,
    }));
  });

export const loadRevocationTasks = (): Promise<QueueItem[]> =>
  safe("revocationTasks", [], async () => {
    const rows = await db.execute<{ id: string; kind: string; name: string | null }>(sql`
      select dt.id, dt.kind, p.name
      from delivery_tasks dt
      join entitlements e on e.id = dt.entitlement_id
      left join products p on p.id = e.product_id
      where dt.status = 'open' and dt.kind = 'revoke_external'
      order by dt.created_at asc
      limit 10`);
    return [...rows].map((r) => ({
      label: r.name ?? "External access",
      meta: "Disable the external account",
      href: "/delivery-tasks",
      tone: "warning" as const,
    }));
  });

const FUNNEL_STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;

export const loadFunnel = (): Promise<DashboardData["funnel"]> =>
  safe(
    "funnel",
    FUNNEL_STAGES.map((s) => ({ label: s, value: 0 })),
    async () => {
      const rows = await db.execute<{ status: string; c: string }>(
        sql`select status::text as status, count(*) as c from leads group by status`,
      );
      const counts = new Map([...rows].map((r) => [r.status, n(r.c)]));
      return FUNNEL_STAGES.map((s) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        value: counts.get(s) ?? 0,
      }));
    },
  );

export const loadConversionRate = (days: number): Promise<DashboardData["conversionRate"]> =>
  safe("conversionRate", { value: 0, delta: NO_DATA }, async () => {
    const rows = await db.execute<{ won: string; lost: string }>(sql`
      select count(*) filter (where status = 'won') as won,
             count(*) filter (where status = 'lost') as lost
      from leads
      where status in ('won', 'lost') and updated_at >= now() - make_interval(days => ${days})`);
    const r = [...rows][0];
    const won = n(r?.won);
    const closed = won + n(r?.lost);
    return {
      value: closed === 0 ? 0 : won / closed,
      delta: closed === 0 ? NO_DATA : `${won} won of ${closed} closed`,
    };
  });

export const loadVisits = (days: number): Promise<DashboardData["visits"]> =>
  safe("visits", { total: 0, delta: NO_DATA, top: [] }, async () => {
    const totals = await db.execute<{ cur: string; prev: string }>(sql`
      select count(*) filter (where created_at >= now() - make_interval(days => ${days})) as cur,
             count(*) filter (where created_at < now() - make_interval(days => ${days})) as prev
      from analytics_events
      where name in ('page_view', 'product_view')
        and created_at >= now() - make_interval(days => ${days * 2})`);
    const t = [...totals][0];
    const top = await db.execute<{ product: string; visits: string }>(sql`
      select p.name as product, count(*) as visits
      from analytics_events ae join products p on p.id = ae.product_id
      where ae.name = 'product_view' and ae.created_at >= now() - make_interval(days => ${days})
      group by p.name order by visits desc limit 5`);
    return {
      total: n(t?.cur),
      delta: deltaText(n(t?.cur), n(t?.prev)),
      top: [...top].map((r) => ({ product: r.product, visits: n(r.visits) })),
    };
  });

export const loadChatbotUsage = (): Promise<DashboardData["chatbotUsage"]> =>
  safe("chatbotUsage", { platform: 0, platformCap: 0, usersAtCap: 0, perUserCap: 0 }, async () => {
    const { chatCapGuard } = await import("@/modules/chat/caps");
    const caps = await chatCapGuard.caps();
    const rows = await db.execute<{ scope: string; count: number }>(
      sql`select scope, count from chat_usage_daily where day = (now() at time zone 'utc')::date`,
    );
    const list = [...rows];
    return {
      platform: n(list.find((r) => r.scope === "platform")?.count),
      platformCap: caps.platformDaily,
      usersAtCap: list.filter((r) => r.scope !== "platform" && n(r.count) >= caps.userDaily).length,
      perUserCap: caps.userDaily,
    };
  });

export const loadNewCustomers = (days: number): Promise<DashboardData["newCustomers"]> =>
  safe("newCustomers", { count: 0, delta: NO_DATA, sparkline: [] }, async () => {
    const totals = await db.execute<{ cur: string; prev: string }>(sql`
      select count(*) filter (where u.created_at >= now() - make_interval(days => ${days})) as cur,
             count(*) filter (where u.created_at < now() - make_interval(days => ${days})) as prev
      from users u join customer_profiles cp on cp.user_id = u.id
      where u.created_at >= now() - make_interval(days => ${days * 2})`);
    const t = [...totals][0];
    const span = Math.min(days, 30);
    const series = await db.execute<{ c: string }>(sql`
      select count(u.id) as c
      from generate_series(current_date - (${span - 1})::int, current_date, interval '1 day') d
      left join users u on u.created_at::date = d::date
        and exists (select 1 from customer_profiles cp where cp.user_id = u.id)
      group by d order by d`);
    return {
      count: n(t?.cur),
      delta: deltaText(n(t?.cur), n(t?.prev)),
      sparkline: [...series].map((r) => n(r.c)),
    };
  });

export const loadSystemHealth = (): Promise<DashboardData["systemHealth"]> =>
  safe("systemHealth", [{ label: "Database", ok: false, detail: "check failed" }], async () => {
    const env = getEnv();
    const out: DashboardData["systemHealth"] = [];
    const started = Date.now();
    await db.execute(sql`select 1`);
    out.push({ label: "Database", ok: true, detail: `${Date.now() - started} ms` });

    const emailOk = env.EMAIL_TRANSPORT !== "resend" || Boolean(env.RESEND_API_KEY);
    out.push({
      label: "Email",
      ok: emailOk,
      detail: emailOk ? `transport ${env.EMAIL_TRANSPORT ?? "default"}` : "RESEND_API_KEY missing",
    });

    const provider = env.AI_PROVIDER ?? "anthropic";
    const aiOk =
      provider === "fake" ||
      (provider === "anthropic" ? Boolean(env.ANTHROPIC_API_KEY) : Boolean(env.OPENAI_API_KEY));
    out.push({
      label: "AI provider",
      ok: aiOk,
      detail: aiOk ? provider : `${provider} key missing`,
    });

    const jobs = await db.execute<{ job: string; status: string | null; started_at: Date }>(sql`
      select distinct on (job) job, status::text as status, started_at
      from job_runs order by job, started_at desc`);
    const list = [...jobs];
    const failing = list.filter((j) => j.status === "error");
    out.push({
      label: "Cron jobs",
      ok: failing.length === 0,
      detail:
        list.length === 0
          ? "no runs yet"
          : failing.length > 0
            ? `${failing.length} failing: ${failing.map((j) => j.job).join(", ")}`
            : `${list.length} jobs, last run ok`,
    });
    return out;
  });
