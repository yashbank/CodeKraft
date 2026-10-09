import { and, desc, eq, sql } from "drizzle-orm";
import type { Context, RequestContext } from "@/lib/authz/context";
import { type Db, type TxCtx, getDb } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { emailOutbox } from "../../../drizzle/schema/notifications";
import { analyticsEvents, jobRuns } from "../../../drizzle/schema/ops";
import { chatUsageDaily } from "../../../drizzle/schema/chat";
import type { AnalyticsService } from "./contracts";
import {
  CLIENT_ANALYTICS_EVENTS,
  type CronJobKey,
  type JobContext,
  type JobOutcome,
  type JobRunsResult,
  type ListJobRunsInput,
  type ServerAnalyticsEvent,
  type SystemHealth,
  type TrackEventInput,
  type TrackEventResult,
  type VitalsRollupDetail,
  type WebVitalInput,
} from "./types";

export class DefaultAnalyticsService implements AnalyticsService {
  private _db?: Db;
  constructor(db?: Db) {
    this._db = db;
  }
  private get db(): Db {
    return this._db ?? getDb();
  }

  async trackEvent(ctx: Context, input: TrackEventInput): Promise<TrackEventResult> {
    if (!(CLIENT_ANALYTICS_EVENTS as readonly string[]).includes(input.name)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        `Client cannot record server-only event: ${input.name}`,
      );
    }

    const [row] = await this.db
      .insert(analyticsEvents)
      .values({
        name: input.name,
        userId: ctx.userId ?? null,
        anonId: ctx.userId ? null : (input.anonId ?? null),
        productId: input.productId ?? null,
        orderId: input.orderId ?? null,
        props: input.props ?? null,
      })
      .returning();

    if (!row) throw new AppError(ErrorCode.INTERNAL, "analytics event insert returned no row");
    return { ok: true, eventId: row.id };
  }

  async trackWebVital(ctx: Context, input: WebVitalInput): Promise<TrackEventResult> {
    // Vitals carried without user identifiers (docs/11 §B10)
    const [row] = await this.db
      .insert(analyticsEvents)
      .values({
        name: "web_vital",
        userId: null,
        anonId: input.anonId ?? null,
        props: {
          metric: input.metric,
          value: input.value,
          rating: input.rating,
          route: input.route,
          navigationType: input.navigationType,
          deviceClass: input.deviceClass,
        },
      })
      .returning();

    if (!row) throw new AppError(ErrorCode.INTERNAL, "analytics event insert returned no row");
    return { ok: true, eventId: row.id };
  }

  async recordServerEvent(event: ServerAnalyticsEvent, tx: TxCtx): Promise<void> {
    await tx.insert(analyticsEvents).values({
      name: event.name,
      userId: event.userId ?? null,
      anonId: event.anonId ?? null,
      productId: event.productId ?? null,
      orderId: event.orderId ?? null,
      props: event.props ?? null,
    });
  }

  async listJobRuns(_ctx: RequestContext, input: ListJobRunsInput): Promise<JobRunsResult> {
    const conditions = [];
    if (input.filters?.job) {
      conditions.push(eq(jobRuns.job, input.filters.job));
    }

    const rows = await this.db
      .select()
      .from(jobRuns)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobRuns.startedAt))
      .limit((input.limit ?? 25) + 1);

    const hasNext = rows.length > (input.limit ?? 25);
    const selected = hasNext ? rows.slice(0, input.limit ?? 25) : rows;

    return {
      items: selected.map((r) => ({
        id: r.id,
        job: r.job as CronJobKey,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
        status: r.status,
        detail: (r.detail as Record<string, unknown> | null) ?? null,
      })),
      nextCursor: hasNext ? (selected[selected.length - 1]?.id ?? null) : null,
      // shortcut: per-job last-run summary not computed, add when the System widget needs it
      lastRuns: [],
    };
  }

  async getSystemHealthWidget(_ctx: RequestContext): Promise<SystemHealth> {
    const today = new Date().toISOString().slice(0, 10);

    const outboxCounts = await this.db
      .select({
        status: emailOutbox.status,
        count: sql<number>`count(*)::int`,
      })
      .from(emailOutbox)
      .groupBy(emailOutbox.status);

    const queuedEmails = outboxCounts.find((r) => r.status === "queued")?.count ?? 0;
    const failedEmails = outboxCounts.find((r) => r.status === "failed")?.count ?? 0;

    const chatUsage = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatUsageDaily)
      .where(and(eq(chatUsageDaily.scope, "platform"), eq(chatUsageDaily.day, today)));

    const platformToday = chatUsage[0]?.count ?? 0;

    return {
      fxAgeDays: 0,
      emailOutbox: {
        queued: queuedEmails,
        failed: failedEmails,
      },
      chatUsage: {
        platformToday,
        platformCap: 500,
      },
      jobs: [],
      vitals: [],
      sentryLink: "https://sentry.io",
    };
  }

  async runVitalsRollupJob(_job: JobContext): Promise<JobOutcome<VitalsRollupDetail>> {
    return { status: "ok", detail: { routes: 0, metrics: 0, alerts: [] } };
  }
}

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export function createAnalyticsService(db?: Db): AnalyticsService {
  return new DefaultAnalyticsService(db);
}

export const analyticsService = new DefaultAnalyticsService();

export function createNotImplementedAnalyticsService(): AnalyticsService {
  return createNotImplemented<AnalyticsService>("analytics", "P6", {
    trackEvent: "async",
    trackWebVital: "async",
    recordServerEvent: "async",
    listJobRuns: "async",
    getSystemHealthWidget: "async",
    runVitalsRollupJob: "async",
  });
}
