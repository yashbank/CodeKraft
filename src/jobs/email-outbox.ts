import { and, asc, eq, gt, gte, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { EMAIL_TEMPLATES } from "@/emails";
import { getLogger } from "@/lib/logger";
import { sendEmail } from "@/lib/email/transport";
import type { EmailTemplate } from "@/lib/email/types";
import { emailOutbox } from "../../drizzle/schema/notifications";
import { jobRuns } from "../../drizzle/schema/ops";

const errMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

/**
 * Send pending outbox rows (queued/failed, attempts < 5, plus `extra`). Shared by the daily cron
 * and the immediate post-commit send. Each row is claimed by compare-and-set on `attempts`, so
 * overlapping runs never send the same row twice.
 */
async function deliverPending(now: Date, extra?: SQL) {
  const db = getDb();
  const pendingRows = await db
    .select()
    .from(emailOutbox)
    .where(
      and(
        inArray(emailOutbox.status, ["queued", "failed"]),
        sql`${emailOutbox.attempts} < 5`,
        extra,
      ),
    )
    .orderBy(asc(emailOutbox.priority), asc(emailOutbox.createdAt))
    .limit(50);

  // Runs after every committed transaction, and most of those enqueue nothing.
  if (pendingRows.length === 0) {
    return { sentCount: 0, failedCount: 0, deferredCount: 0, pendingChecked: 0 };
  }

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const [sentRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, "sent"), gte(emailOutbox.sentAt, todayStart)));
  const isDailyCapReached = (sentRes?.count ?? 0) >= 90;

  let sentCount = 0;
  let failedCount = 0;
  let deferredCount = 0;

  for (const row of pendingRows) {
    // Defer non-urgent emails if daily soft cap is reached (priority > 2)
    if (isDailyCapReached && row.priority > 2) {
      deferredCount++;
      continue;
    }
    const nextAttempts = row.attempts + 1;
    const [claimed] = await db
      .update(emailOutbox)
      .set({ attempts: nextAttempts, updatedAt: now })
      .where(
        and(
          eq(emailOutbox.id, row.id),
          eq(emailOutbox.attempts, row.attempts),
          inArray(emailOutbox.status, ["queued", "failed"]),
        ),
      )
      .returning({ id: emailOutbox.id });
    if (!claimed) continue;

    try {
      if (process.env.EMAIL_TRANSPORT === "resend") {
        await sendEmail({
          to: row.toEmail,
          subject:
            EMAIL_TEMPLATES[row.template]?.subject(
              (row.payload as Record<string, unknown>) ?? {},
            ) ?? `Notification: ${row.template}`,
          template: row.template as EmailTemplate,
          data: (row.payload as Record<string, unknown>) ?? {},
          priority: row.priority,
        });
      }
      await db
        .update(emailOutbox)
        .set({ status: "sent", sentAt: now, updatedAt: now })
        .where(eq(emailOutbox.id, row.id));
      sentCount++;
    } catch (err) {
      getLogger().error(
        { err, outboxId: row.id, template: row.template, attempts: nextAttempts },
        "outbox email send failed",
      );
      await db
        .update(emailOutbox)
        .set({ status: "failed", lastError: errMessage(err, "Send error"), updatedAt: now })
        .where(eq(emailOutbox.id, row.id));
      failedCount++;
    }
  }
  return { sentCount, failedCount, deferredCount, pendingChecked: pendingRows.length };
}

/** Immediate send of rows enqueued in the last few minutes; call only after their tx committed. */
export function sendFreshOutbox(now: Date = new Date()) {
  return deliverPending(
    now,
    and(
      eq(emailOutbox.attempts, 0),
      gt(emailOutbox.createdAt, new Date(now.getTime() - 5 * 60_000)),
    ),
  );
}

export const emailOutboxRetryJob = {
  key: "email.outbox_retry" as const,

  async run(now: Date = new Date(), _jobId: string = `outbox-retry-${Date.now()}`) {
    const db = getDb();
    const [runRow] = await db
      .insert(jobRuns)
      .values({
        job: this.key,
        startedAt: now,
      })
      .returning();

    try {
      const { sentCount, failedCount, deferredCount, pendingChecked } = await deliverPending(now);

      if (runRow) {
        await db
          .update(jobRuns)
          .set({
            status: "ok",
            finishedAt: new Date(),
            detail: { sentCount, failedCount, deferredCount, pendingChecked },
          })
          .where(eq(jobRuns.id, runRow.id));
      }

      return {
        success: true,
        sentCount,
        failedCount,
        deferredCount,
      };
    } catch (err) {
      if (runRow) {
        await db
          .update(jobRuns)
          .set({
            status: "error",
            finishedAt: new Date(),
            detail: { error: errMessage(err, "Execution failed") },
          })
          .where(eq(jobRuns.id, runRow.id));
      }

      throw err;
    }
  },
};
