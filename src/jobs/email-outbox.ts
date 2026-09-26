import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email/transport";
import { emailOutbox } from "../../drizzle/schema/notifications";
import { jobRuns } from "../../drizzle/schema/ops";

export const emailOutboxRetryJob = {
  key: "email.outbox_retry" as const,

  async run(now: Date = new Date(), jobId: string = `outbox-retry-${Date.now()}`) {
    const db = getDb();
    const [runRow] = await db
      .insert(jobRuns)
      .values({
        job: this.key,
        startedAt: now,
      })
      .returning();

    try {
      // Calculate sent today count
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const sentTodayCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(emailOutbox)
        .where(and(eq(emailOutbox.status, "sent"), gte(emailOutbox.sentAt, todayStart)));

      const sentToday = sentTodayCountResult[0]?.count ?? 0;
      const isDailyCapReached = sentToday >= 90;

      // Fetch queued/failed rows with attempts < 5
      const pendingRows = await db
        .select()
        .from(emailOutbox)
        .where(
          and(
            inArray(emailOutbox.status, ["queued", "failed"]),
            sql`${emailOutbox.attempts} < 5`,
          ),
        )
        .orderBy(asc(emailOutbox.priority), asc(emailOutbox.createdAt))
        .limit(50);

      let sentCount = 0;
      let failedCount = 0;
      let deferredCount = 0;

      for (const row of pendingRows) {
        // Defer non-urgent emails if daily soft cap is reached (priority > 2)
        if (isDailyCapReached && row.priority > 2) {
          deferredCount++;
          continue;
        }

        try {
          if (process.env.EMAIL_TRANSPORT === "resend") {
            await sendEmail({
              to: row.toEmail,
              subject: `Notification: ${row.template}`,
              template: row.template as any,
              data: (row.payload as Record<string, unknown>) ?? {},
              priority: row.priority,
            });
          }

          await db
            .update(emailOutbox)
            .set({
              status: "sent",
              sentAt: now,
              attempts: row.attempts + 1,
              updatedAt: now,
            })
            .where(eq(emailOutbox.id, row.id));

          sentCount++;
        } catch (err: any) {

          const nextAttempts = row.attempts + 1;
          await db
            .update(emailOutbox)
            .set({
              status: nextAttempts >= 5 ? "failed" : "failed",
              attempts: nextAttempts,
              lastError: err?.message ?? "Send error",
              updatedAt: now,
            })
            .where(eq(emailOutbox.id, row.id));

          failedCount++;
        }
      }

      if (runRow) {
        await db
          .update(jobRuns)
          .set({
            status: "ok",
            finishedAt: new Date(),
            detail: { sentCount, failedCount, deferredCount, pendingChecked: pendingRows.length },
          })
          .where(eq(jobRuns.id, runRow.id));
      }

      return {
        success: true,
        sentCount,
        failedCount,
        deferredCount,
      };
    } catch (err: any) {
      if (runRow) {
        await db
          .update(jobRuns)
          .set({
            status: "error",
            finishedAt: new Date(),
            detail: { error: err?.message ?? "Execution failed" },
          })
          .where(eq(jobRuns.id, runRow.id));
      }

      throw err;
    }
  },
};
