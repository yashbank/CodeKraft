/**
 * Analytics / ops service contract — docs/06 §2.13 API-OPS-01..03, §3.3 `vitals.rollup`,
 * docs/11 §B10/§B13, D-1301/D-1302. Implementation in P7/P9.
 */
import type { TxCtx } from "@/lib/db";
import type { Context, RequestContext } from "@/lib/authz/context";
import type {
  JobContext,
  JobOutcome,
  JobRunsResult,
  ListJobRunsInput,
  ServerAnalyticsEvent,
  SystemHealth,
  TrackEventInput,
  TrackEventResult,
  VitalsRollupDetail,
  WebVitalInput,
} from "./types";

export interface AnalyticsService {
  /**
   * API-OPS-01 `trackEvent` — visitor or customer, rate class `analytics`. Only
   * `CLIENT_ANALYTICS_EVENTS` names are accepted; server-only names → `FORBIDDEN`.
   * `userId` comes from the session, `anonId` from the body otherwise. Never audited.
   */
  trackEvent(ctx: Context, input: TrackEventInput): Promise<TrackEventResult>;

  /** `POST /api/analytics/vitals` beacon → `analytics_events(name='web_vital')` (docs/11 §B10). */
  trackWebVital(ctx: Context, input: WebVitalInput): Promise<TrackEventResult>;

  /**
   * Server-side ingest used by other modules' actions (`A:` column) inside their own transaction —
   * e.g. `payment_confirmed` from API-PAY-03, `chat_started` from API-CHAT-06.
   */
  recordServerEvent(event: ServerAnalyticsEvent, tx: TxCtx): Promise<void>;

  /** API-OPS-02 `listJobRuns` — `settings.read`. */
  listJobRuns(ctx: RequestContext, input: ListJobRunsInput): Promise<JobRunsResult>;

  /** API-OPS-03 `getSystemHealthWidget` — `dashboard.admin`; read-only, not audited. */
  getSystemHealthWidget(ctx: RequestContext): Promise<SystemHealth>;

  /** Cron `daily/vitals.rollup`: p75 per metric per route (28 d) for the System widget; alerts per docs/11 §B13. */
  runVitalsRollupJob(job: JobContext): Promise<JobOutcome<VitalsRollupDetail>>;
}
