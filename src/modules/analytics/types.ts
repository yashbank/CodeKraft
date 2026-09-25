/**
 * Analytics & ops — docs/06 §2.13 API-OPS-01..03 (`modules/analytics`), §3.3 cron job keys,
 * docs/11 §B10/§B13 (`web_vital` rows, `vitals.rollup`), D-1302 event list.
 *
 * Also hosts the cron-job contract shapes (`JobContext`, `JobOutcome`, `CRON_JOB_KEYS`) that every
 * domain-C module's job method uses — `job_runs` is an ops table (docs/05 §11).
 */
import { z } from "zod";

export const uuid = z.uuid();
export const isoDateTime = z.iso.datetime({ offset: true });

// ---------------------------------------------------------------------------------------------
// Event names (D-1302; docs/06 API-OPS-01; docs/11 §B10 `web_vital`)
// ---------------------------------------------------------------------------------------------

/**
 * Every `analytics_events.name`. `page_view` and `web_vital` are client-originated; the rest are
 * written by the owning Server Action (`A:` column in docs/06 §2).
 */
export const ANALYTICS_EVENTS = [
  "page_view",
  "product_view",
  "wishlist_add",
  "checkout_start",
  "payment_submitted",
  "payment_confirmed",
  "inquiry_submitted",
  "signup",
  "login",
  "chat_started",
  "chat_escalated",
  "chat_lead_captured",
  "web_vital",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Names the client may send through API-OPS-01; any other name → `FORBIDDEN` (server-only). */
export const CLIENT_ANALYTICS_EVENTS = [
  "page_view",
  "product_view",
  "web_vital",
] as const satisfies readonly AnalyticsEventName[];
export type ClientAnalyticsEventName = (typeof CLIENT_ANALYTICS_EVENTS)[number];

export const analyticsEventNameSchema = z.enum(ANALYTICS_EVENTS);

const propValue = z.union([z.string().max(500), z.number().finite(), z.boolean()]);

/** `props`: ≤ 20 keys, ≤ 2 KB serialised (docs/06 API-OPS-01). */
export const analyticsPropsSchema = z
  .record(z.string().min(1).max(64), propValue)
  .refine((p) => Object.keys(p).length <= 20, { message: "At most 20 props" })
  .refine((p) => JSON.stringify(p).length <= 2048, { message: "props exceed 2 KB" });
export type AnalyticsProps = z.infer<typeof analyticsPropsSchema>;

/** API-OPS-01 `trackEvent` — Visitor/customer, rate class `analytics`. */
export const trackEventSchema = z
  .object({
    name: analyticsEventNameSchema,
    productId: uuid.optional(),
    orderId: uuid.optional(),
    props: analyticsPropsSchema.optional(),
    /** Anonymous visitor id (cookie-less, docs/11 §A9); ignored when a session exists. */
    anonId: uuid.optional(),
  })
  .strict();
export type TrackEventInput = z.infer<typeof trackEventSchema>;

export const WEB_VITAL_METRICS = ["LCP", "INP", "CLS", "TTFB", "FCP"] as const;
export type WebVitalMetric = (typeof WEB_VITAL_METRICS)[number];
export const WEB_VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;

/** `POST /api/analytics/vitals` beacon body (docs/11 §B10) → `analytics_events(name='web_vital')`. */
export const webVitalSchema = z
  .object({
    metric: z.enum(WEB_VITAL_METRICS),
    value: z.number().finite().nonnegative(),
    rating: z.enum(WEB_VITAL_RATINGS),
    /** Route pattern (`/products/[slug]`), never the concrete path. */
    route: z.string().trim().min(1).max(200),
    navigationType: z.string().max(40).optional(),
    deviceClass: z.enum(["mobile", "desktop"]).optional(),
    anonId: uuid.optional(),
  })
  .strict();
export type WebVitalInput = z.infer<typeof webVitalSchema>;

/** Server-side ingest (called by other modules inside their transaction; not client-reachable). */
export interface ServerAnalyticsEvent {
  name: Exclude<AnalyticsEventName, ClientAnalyticsEventName>;
  userId?: string | null;
  anonId?: string | null;
  productId?: string | null;
  orderId?: string | null;
  props?: AnalyticsProps;
}

// ---------------------------------------------------------------------------------------------
// Cron jobs (docs/06 §3.3, docs/12 §2.3)
// ---------------------------------------------------------------------------------------------

export const FREQUENT_JOB_KEYS = [
  "publish.scheduled",
  "orders.expire",
  "quotes.expire",
  "email.outbox_retry",
  "invoices.regenerate_pending",
  "retention.purge_tokens",
] as const;

export const DAILY_JOB_KEYS = [
  "subscriptions.remind_grace_suspend",
  "entitlements.expire",
  "fx.refresh",
  "knowledge.reindex",
  "retention.purge",
  "finance.reconcile",
  "queries.auto_close",
  "users.anonymise",
  "admin.overdue_digest",
  "vitals.rollup",
  "backups.verify",
  "audit.export",
  "health.jobs_check",
] as const;

export const CRON_JOB_KEYS = [...FREQUENT_JOB_KEYS, ...DAILY_JOB_KEYS] as const;
export type CronJobKey = (typeof CRON_JOB_KEYS)[number];
export type CronEndpoint = "frequent" | "daily";

export const CRON_ENDPOINT_FOR_JOB: Readonly<Record<CronJobKey, CronEndpoint>> = Object.freeze(
  Object.fromEntries([
    ...FREQUENT_JOB_KEYS.map((k) => [k, "frequent"] as const),
    ...DAILY_JOB_KEYS.map((k) => [k, "daily"] as const),
  ]) as Record<CronJobKey, CronEndpoint>,
);

/** Passed to every job method; the runner owns the `job_runs` row and the window check (§1.5). */
export interface JobContext {
  job: CronJobKey;
  /** `job_runs.id` of this invocation. */
  runId: string;
  /** Wall clock the job must use for every "now" comparison (deterministic in tests). */
  now: Date;
  /** Start of the idempotency window (15 min for `frequent`, the IST day for `daily`). */
  windowStart: Date;
  requestId: string;
}

/** What a job returns; `detail` is persisted to `job_runs.detail`. */
export interface JobOutcome<D extends Record<string, unknown> = Record<string, unknown>> {
  status: "ok" | "error";
  detail: D;
  /** Non-fatal problems the job continued past (also stored in `detail`). */
  warnings?: string[];
}

// ---------------------------------------------------------------------------------------------
// Ops reads (API-OPS-02/03)
// ---------------------------------------------------------------------------------------------

export const JOB_STATUSES = ["ok", "error", "running"] as const;

/** API-OPS-02 `listJobRuns` — `settings.read`. */
export const listJobRunsSchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(25),
    filters: z
      .object({
        job: z.enum(CRON_JOB_KEYS).optional(),
        status: z.enum(JOB_STATUSES).optional(),
        dateFrom: isoDateTime.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type ListJobRunsInput = z.infer<typeof listJobRunsSchema>;

export interface JobRunRow {
  id: string;
  job: CronJobKey;
  startedAt: string;
  finishedAt: string | null;
  status: "ok" | "error" | null;
  detail: Record<string, unknown> | null;
}

export interface JobRunsResult {
  items: JobRunRow[];
  nextCursor: string | null;
  /** Last run per job key plus whether a window was missed (docs/12 §8.1 `health.jobs_check`). */
  lastRuns: Array<{
    job: CronJobKey;
    lastOkAt: string | null;
    lastStatus: "ok" | "error" | null;
    missedWindow: boolean;
  }>;
}

/** API-OPS-03 `getSystemHealthWidget` output. */
export interface SystemHealth {
  jobs: Array<{ job: CronJobKey; lastOkAt: string | null; healthy: boolean }>;
  fxAgeDays: number | null;
  emailOutbox: { queued: number; failed: number };
  chatUsage: { platformToday: number; platformCap: number };
  vitals: Array<{
    metric: WebVitalMetric;
    route: string;
    p75: number;
    rating: (typeof WEB_VITAL_RATINGS)[number];
  }>;
  sentryLink: string | null;
}

/** `daily/vitals.rollup` detail (docs/11 §B13: p75 per metric per route, 28-day window). */
export interface VitalsRollupDetail extends Record<string, unknown> {
  routes: number;
  metrics: number;
  /** Routes breaching thresholds for 7 consecutive days → `N:` to super admins. */
  alerts: Array<{ route: string; metric: WebVitalMetric; p75: number; deviceClass: string }>;
}

export interface TrackEventResult {
  ok: true;
}
