/**
 * Admin overdue leads & revoke tasks digest job (docs/06 §3.3 daily endpoint, PHASE-06 P6.4).
 */
import { leadsService } from "@/modules/leads/service";

export const leadDigestJob = {
  key: "admin.overdue_digest" as const,

  async run(now: Date = new Date(), jobId: string = `admin-digest-${Date.now()}`) {
    return await leadsService.runOverdueDigestJob({
      job: "admin.overdue_digest",
      runId: jobId,
      now,
      windowStart: now,
      requestId: jobId,
    });
  },
};

export const leadOverdueDigestJob = leadDigestJob;
