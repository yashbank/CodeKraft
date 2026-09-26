/**
 * Retention and privacy sweep cron jobs (docs/06 §3.3 daily endpoint, PHASE-05 P5.7).
 */
import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { sessions, users, verifications } from "../../drizzle/schema/auth";

export const retentionPurgeTokensJob = {
  key: "retention.purge_tokens" as const,
  async run(now: Date = new Date()) {
    return await withTx(async (tx) => {
      // 1. Purge expired sessions
      const deletedSessions = await tx
        .delete(sessions)
        .where(lte(sessions.expiresAt, now))
        .returning({ id: sessions.id });

      // 2. Purge expired verification tokens
      const deletedTokens = await tx
        .delete(verifications)
        .where(lte(verifications.expiresAt, now))
        .returning({ id: verifications.id });

      return {
        ok: true,
        detail: {
          purgedSessions: deletedSessions.length,
          purgedTokens: deletedTokens.length,
        },
      };
    });
  },
};

export const usersAnonymiseSweepJob = {
  key: "users.anonymise" as const,
  async run(now: Date = new Date()) {
    return await withTx(async (tx) => {
      // Find deleted users who have not yet been anonymized
      const unanonymizedUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(isNotNull(users.deletedAt), isNull(users.anonymizedAt)));

      let anonymizedCount = 0;
      for (const u of unanonymizedUsers) {
        await tx
          .update(users)
          .set({
            name: "Deleted User",
            email: `deleted_${u.id}@anonymized.codekraft.dev`,
            phoneNumber: null,
            image: null,
            anonymizedAt: now,
            updatedAt: now,
          })
          .where(eq(users.id, u.id));
        anonymizedCount++;
      }

      return {
        ok: true,
        detail: {
          anonymizedUsers: anonymizedCount,
        },
      };
    });
  },
};
