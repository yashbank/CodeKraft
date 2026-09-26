/**
 * Chat retention purge cron job (docs/06 §3.3 daily endpoint, PHASE-06 P6.6).
 * Purges conversations older than 12 months (purge_after < today).
 */
import { chatService } from "@/modules/chat/service";

export const chatPurgeJob = {
  key: "retention.purge" as const,

  async run(now: Date = new Date(), jobId: string = `chat-purge-${Date.now()}`) {
    return await chatService.runRetentionPurgeJob({
      job: "retention.purge",
      runId: jobId,
      now,
      windowStart: now,
      requestId: jobId,
    });
  },
};
