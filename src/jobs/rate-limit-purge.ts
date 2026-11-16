/** Deletes expired `rate_limit_buckets` rows (docs/09 §7); runs from the daily cron. */
import { lte } from "drizzle-orm";
import { withTx } from "@/lib/db";
import { rateLimitBuckets } from "../../drizzle/schema/ops";

export const rateLimitPurgeJob = {
  key: "rate_limit.purge" as const,
  async run(now: Date = new Date()) {
    return await withTx(async (tx) => {
      const deleted = await tx
        .delete(rateLimitBuckets)
        .where(lte(rateLimitBuckets.expiresAt, now))
        .returning({ key: rateLimitBuckets.key });
      return { ok: true, detail: { purgedBuckets: deleted.length } };
    });
  },
};
