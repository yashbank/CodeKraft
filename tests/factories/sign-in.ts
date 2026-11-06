import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "../../drizzle/schema/audit";
import { accounts } from "../../drizzle/schema/auth";

/**
 * Make an account look like one that has really signed in: a password (when none yet) and one
 * `auth.sign_in` audit row, which is what the admin verification check reads.
 */
export async function markSignedIn(userId: string): Promise<void> {
  const [has] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);
  if (!has) {
    await db
      .insert(accounts)
      .values({ userId, accountId: userId, providerId: "credential", password: "x" });
  }
  await db.insert(auditLogs).values({
    actorId: userId,
    action: "auth.sign_in",
    subjectType: "session",
    subjectId: crypto.randomUUID(),
  });
}
