/**
 * Subscriptions & Entitlements expiry cron jobs (docs/06 §3.3 daily endpoint, PHASE-05 P5.7).
 */
import { subscriptionsService } from "@/modules/subscriptions/service";
import { entitlementsService } from "@/modules/entitlements/service";

export const subscriptionsRemindGraceSuspendJob = {
  key: "subscriptions.remind_grace_suspend" as const,
  async run(now: Date = new Date(), runId: string = `sub-remind-${Date.now()}`) {
    return await subscriptionsService.runRemindGraceSuspendJob({
      job: this.key,
      runId,
      now,
      windowStart: now,
      requestId: runId,
    });
  },
};

export const entitlementsExpireJob = {
  key: "entitlements.expire" as const,
  async run(now: Date = new Date(), runId: string = `ent-expire-${Date.now()}`) {
    return await entitlementsService.runExpireJob({
      job: this.key,
      runId,
      now,
      windowStart: now,
      requestId: runId,
    });
  },
};
