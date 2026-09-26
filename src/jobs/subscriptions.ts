/**
 * Subscriptions & Entitlements expiry cron jobs (docs/06 §3.3 daily endpoint, PHASE-05 P5.7).
 */
import { subscriptionsService } from "@/modules/subscriptions/service";
import { entitlementsService } from "@/modules/entitlements/service";

export const subscriptionsRemindGraceSuspendJob = {
  key: "subscriptions.remind_grace_suspend" as const,
  async run(now: Date = new Date(), jobId: string = `sub-remind-${Date.now()}`) {
    return await subscriptionsService.runRemindGraceSuspendJob({
      jobId,
      now,
    });
  },
};

export const entitlementsExpireJob = {
  key: "entitlements.expire" as const,
  async run(now: Date = new Date(), jobId: string = `ent-expire-${Date.now()}`) {
    return await entitlementsService.runExpireJob({
      jobId,
      now,
    });
  },
};
