/**
 * Finance metrics queries (definitions live in ./metrics-core.ts).
 */
import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { db } from "@/lib/db";
import { toMinor } from "./minor";
import { deriveMetrics, rawSumsFromRow, rawSumsSql, type FinanceMetrics } from "./metrics-core";

export * from "./metrics-core";

/** Outstanding = unpaid INR orders created in the window (initiated/submitted payments + no payment). */
export async function getOutstandingMinor(
  database: DbOrTx,
  range?: { dateFrom: string; dateTo: string },
): Promise<number> {
  const from = range ? sql`AND o.created_at >= ${`${range.dateFrom}T00:00:00.000Z`}` : sql``;
  const to = range ? sql`AND o.created_at <= ${`${range.dateTo}T23:59:59.999Z`}` : sql``;
  const rows = await database.execute<{ outstanding: string }>(sql`
    SELECT COALESCE(SUM(o.total_minor), 0) AS outstanding
    FROM orders o
    WHERE o.status = 'pending_payment' AND o.currency = 'INR' ${from} ${to}
  `);
  return toMinor([...rows][0]?.outstanding);
}

export interface FinanceSummary extends FinanceMetrics {
  outstandingMinor: number;
}

/** All metrics for a date window (inclusive, UTC). Omit `range` for all time. */
export async function getFinanceSummary(
  range?: { dateFrom: string; dateTo: string },
  database: DbOrTx = db,
): Promise<FinanceSummary> {
  const where = range
    ? sql`WHERE le.created_at >= ${`${range.dateFrom}T00:00:00.000Z`} AND le.created_at <= ${`${range.dateTo}T23:59:59.999Z`}`
    : sql``;
  const rows = await database.execute<Record<string, unknown>>(sql`
    SELECT ${rawSumsSql("le")} FROM ledger_entries le ${where}
  `);
  const metrics = deriveMetrics(rawSumsFromRow([...rows][0] ?? {}));
  return { ...metrics, outstandingMinor: await getOutstandingMinor(database, range) };
}
