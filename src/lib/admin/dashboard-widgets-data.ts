/**
 * Real data sources for the dashboard widgets that used to be hard-coded empty (service
 * checklists, revocation tasks, pipeline funnel, conversion rate, visits, chatbot usage,
 * customers, system health). Server-only; each loader returns the exact `DashboardData` slice and
 * never throws (a failed query becomes the empty state plus a server log line).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getPrivateBucketName, getStorageDriver } from "@/lib/storage";
import { runHealthChecks } from "./system-health";
import type { DashboardData, QueueItem } from "@/components/admin/types";
import { HEATMAP_DAYS, bucketWeekdayHour, emptyHeatmap } from "@/modules/dashboard-widgets/heatmap";

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

// shortcut: buckets up to 50k order timestamps in JS, move to a SQL group-by past that volume.
export const loadOrdersHeatmap = (): Promise<DashboardData["ordersHeatmap"]> =>
  safe("ordersHeatmap", emptyHeatmap(), async () => {
    const rows = await db.execute<{ created_at: Date }>(sql`
      select created_at from orders
      where created_at >= now() - make_interval(days => ${HEATMAP_DAYS})
      order by created_at desc limit 50000`);
    return bucketWeekdayHour([...rows].map((r) => r.created_at));
  });

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
      href: "/entitlements",
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
  safe("systemHealth", [UNAVAILABLE_HEALTH()], () =>
    runHealthChecks({
      query: async (q) => [...(await db.execute(q))] as Array<Record<string, unknown>>,
      headProbe: () => getStorageDriver().headObject(getPrivateBucketName(), ".health-probe"),
      env: getEnv(),
      expectedMigrations: journalLength(),
    }),
  );

/** Repo migration count; undefined when the journal is not shipped with the runtime. */
function journalLength(): number | undefined {
  try {
    const j = JSON.parse(
      readFileSync(join(process.cwd(), "drizzle/migrations/meta/_journal.json"), "utf8"),
    );
    return Array.isArray(j.entries) ? j.entries.length : undefined;
  } catch {
    return undefined;
  }
}

const UNAVAILABLE_HEALTH = (): DashboardData["systemHealth"][number] => ({
  label: "Health checks unavailable",
  ok: false,
  status: "fail",
  detail: "could not run checks",
  checkedAt: new Date().toISOString(),
});
