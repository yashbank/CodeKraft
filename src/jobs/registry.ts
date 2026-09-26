/**
 * Centralized cron job registry (docs/06 §3.3, docs/12 §2.3, P9.4).
 */
import { scheduledPublishJob } from "./publish";
import { orderExpiryJob } from "./order-expiry";
import { quoteExpiryJob } from "./quote-expiry";
import { emailOutboxRetryJob } from "./email-outbox";
import { retentionPurgeTokensJob, usersAnonymiseSweepJob } from "./retention";
import { chatPurgeJob } from "./chat-purge";
import { subscriptionsRemindGraceSuspendJob, entitlementsExpireJob } from "./subscriptions";
import { fxRefreshJob } from "./fx";
import { knowledgeReindexJob } from "./knowledge";
import { leadOverdueDigestJob } from "./lead-digest";

export interface JobExecutionReport {
  job: string;
  status: "ok" | "skipped" | "error";
  durationMs: number;
  result?: unknown;
  error?: string;
}

export async function runFrequentJobs(now: Date = new Date()): Promise<JobExecutionReport[]> {
  const reports: JobExecutionReport[] = [];

  const frequentJobs = [
    { name: "publish.scheduled", fn: () => scheduledPublishJob.run(now) },
    { name: "orders.expire", fn: () => orderExpiryJob.run(now) },
    { name: "quotes.expire", fn: () => quoteExpiryJob.run(now) },
    { name: "email.outbox_retry", fn: () => emailOutboxRetryJob.run(now) },
    { name: "retention.purge_tokens", fn: () => retentionPurgeTokensJob.run() },
  ];

  for (const job of frequentJobs) {
    const t0 = Date.now();
    try {
      const result = await job.fn();
      reports.push({
        job: job.name,
        status: "ok",
        durationMs: Date.now() - t0,
        result,
      });
    } catch (err) {
      reports.push({
        job: job.name,
        status: "error",
        durationMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return reports;
}

export async function runDailyJobs(now: Date = new Date()): Promise<JobExecutionReport[]> {
  const reports: JobExecutionReport[] = [];

  const dailyJobs = [
    { name: "subscriptions.remind_grace_suspend", fn: () => subscriptionsRemindGraceSuspendJob.run(now) },
    { name: "entitlements.expire", fn: () => entitlementsExpireJob.run(now) },
    { name: "fx.refresh", fn: () => fxRefreshJob.run(now) },
    { name: "knowledge.reindex", fn: () => knowledgeReindexJob.run(now) },
    { name: "retention.purge", fn: () => chatPurgeJob.run(now) },
    { name: "users.anonymise", fn: () => usersAnonymiseSweepJob.run(now) },
    { name: "admin.overdue_digest", fn: () => leadOverdueDigestJob.run(now) },
  ];

  for (const job of dailyJobs) {
    const t0 = Date.now();
    try {
      const result = await job.fn();
      reports.push({
        job: job.name,
        status: "ok",
        durationMs: Date.now() - t0,
        result,
      });
    } catch (err) {
      reports.push({
        job: job.name,
        status: "error",
        durationMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return reports;
}
