import { after } from "next/server";
import { getEnv } from "@/lib/env";
import { getLogger } from "@/lib/logger";

/**
 * Send freshly committed outbox rows now instead of waiting for the daily cron (Hobby plan).
 * Best-effort: a failure leaves the row for the cron retry and never fails the caller.
 * Must be called after the enqueuing transaction has committed.
 */
export function scheduleOutboxFlush(): void {
  if (getEnv().EMAIL_TRANSPORT !== "resend") return;
  const task = import("@/jobs/email-outbox")
    .then((m) => m.sendFreshOutbox())
    .then(() => undefined)
    .catch((err: unknown) => getLogger().error({ err }, "immediate outbox send failed"));
  try {
    after(task); // keeps the serverless function alive until the send finishes
  } catch {
    // No Next request scope (scripts, cron, tests): the promise still runs; callers may await nothing.
  }
}
