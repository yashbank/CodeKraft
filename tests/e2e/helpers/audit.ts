/**
 * Security test helper (SA-23, PHASE-03 P3.1).
 * Asserts that an audit row exists for the given action and subjectId.
 */
import { eq, and } from "drizzle-orm";
import { auditLogs } from "../../../drizzle/schema/audit";
import { getDb } from "@/lib/db";

export async function expectAuditRow(
  action: string,
  subjectId: string,
): Promise<{ id: string; action: string; subjectId: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      subjectId: auditLogs.subjectId,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, action), eq(auditLogs.subjectId, subjectId)))
    .limit(1);

  if (!row) {
    throw new Error(
      `Expected audit row with action "${action}" and subjectId "${subjectId}" was not found.`,
    );
  }

  return row;
}
