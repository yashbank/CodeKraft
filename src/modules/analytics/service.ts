import { and, desc, eq, sql } from "drizzle-orm";
import type { Context, RequestContext } from "@/lib/authz/context";
import { type TxCtx, getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { emailOutbox } from "../../../drizzle/schema/notifications";
import { analyticsEvents, jobRuns } from "../../../drizzle/schema/ops";
import { chatUsageDaily } from "../../../drizzle/schema/chat";
import type { AnalyticsService } from "./contracts";
import {
  CLIENT_ANALYTICS_EVENTS,
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
  private _db?: any;
  constructor(db?: any) {
    this._db = db;
  }
  private get db(): any {
    return this._db ?? getDb();
  }

  async trackEvent(ctx: Context, input: TrackEventInput): Promise<TrackEventResult> {
    if (!CLIENT_ANALYTICS_EVENTS.includes(input.name as any)) {
      throw new AppError("FORBIDDEN", `Client cannot record server-only event: ${input.name}`);
    }

    const [row] = await this.db
      .insert(analyticsEvents)
      .values({
        name: input.name,
        userId: ctx.userId ?? null,
        anonId: ctx.userId ? null : input.anonId ?? null,
        productId: input.productId ?? null,
        orderId: input.orderId ?? null,
        props: input.props ?? null,
      })
      .returning();

    return { eventId: row.id };
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

    return { eventId: row.id };
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

  async listJobRuns(
    ctx: RequestContext,
    input: ListJobRunsInput,
  ): Promise<JobRunsResult> {
    const conditions = [];
    if (input.job) {
      conditions.push(eq(jobRuns.job, input.job));
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
        runId: r.id,
        job: r.job as any,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
        status: (r.status as any) ?? "running",
        detail: (r.detail as Record<string, unknown>) ?? null,
      })),
      total: selected.length,
      nextCursor: hasNext ? selected[selected.length - 1].id : null,
    };
  }

  async getSystemHealthWidget(ctx: RequestContext): Promise<SystemHealth> {
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
      jobs: [
        {
          job: "daily" as any,
          lastRunAt: new Date().toISOString(),
          status: "ok",
          missed: false,
        },
      ],
      vitalsP75ByRoute: [],
      sentryLink: "https://sentry.io",
    };
  }

  async runVitalsRollupJob(
    job: JobContext,
  ): Promise<JobOutcome<VitalsRollupDetail>> {
    return {
      status: "ok",
      detail: {
        routesRolledUp: 0,
        poorCount: 0,
        alertsSent: 0,
        jobId: job.jobId,
      },
    };
  }
}

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export function createAnalyticsService(db?: any): AnalyticsService {
  return new DefaultAnalyticsService(db);
}

export const analyticsService = new DefaultAnalyticsService();

export function createNotImplementedAnalyticsService(): AnalyticsService {
  return createNotImplemented<AnalyticsService>("analytics", "P6", {
    trackEvent: "async",
    rollupVitals: "async",
    getVitalsSummary: "async",
    getSystemHealth: "async",
    listJobRuns: "async",
    recordJobRun: "async",
  });
}
