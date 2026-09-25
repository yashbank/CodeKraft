/**
 * Built-in implementations of the finance ports that only need the database (deps.ts):
 *  - `defaultOwnershipAt`: the ownership version active at an instant (docs/06 §4.2, BR-05) —
 *    the latest non-pending version whose `effective_from` is at or before the instant; falls back
 *    to the current `active` version for products whose history starts after the instant.
 *  - `defaultRateToInr`: `fx_rates(base=currency, quote='INR')` at or before the IST day
 *    (FR-PAY-15), falling back to `@/lib/fx` (static table) when no row exists.
 *  - `defaultAuditLog`: one `audit_logs` row inside the caller's transaction (docs/06 §1.6).
 */
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { auditLogs } from "../../../drizzle/schema/audit";
import { users } from "../../../drizzle/schema/auth";
import { productOwnershipLines, productOwnerships } from "../../../drizzle/schema/ownership";
import { fxRates } from "../../../drizzle/schema/settings";
import { partners } from "../../../drizzle/schema/users-ext";
import { isoDate } from "@/lib/dates";
import { type DbOrTx, type TxCtx } from "@/lib/db";
import { getRate } from "@/lib/fx";
import type { Currency } from "@/lib/money";
import type { AuditService } from "@/modules/audit/contracts";
import { auditEntryFromActor } from "@/modules/audit/types";
import type { OwnershipVersionView } from "@/modules/ownership/types";

async function withLines(
  row: typeof productOwnerships.$inferSelect,
  db: DbOrTx,
): Promise<OwnershipVersionView> {
  const lines = await db
    .select({
      partnerId: productOwnershipLines.partnerId,
      shareBps: productOwnershipLines.shareBps,
      displayName: partners.displayName,
      createdAt: productOwnershipLines.createdAt,
    })
    .from(productOwnershipLines)
    .innerJoin(partners, eq(partners.id, productOwnershipLines.partnerId))
    .where(eq(productOwnershipLines.ownershipId, row.id))
    .orderBy(productOwnershipLines.createdAt, productOwnershipLines.partnerId);
  const [creator] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, row.createdBy))
    .limit(1);
  return {
    id: row.id,
    productId: row.productId,
    version: row.version,
    status: row.status,
    companyCutBps: row.companyCutBps,
    lines: lines.map((l) => ({
      partnerId: l.partnerId,
      displayName: l.displayName,
      shareBps: l.shareBps,
    })),
    effectiveFrom: row.effectiveFrom === null ? null : new Date(row.effectiveFrom).toISOString(),
    approvalRequestId: row.approvalRequestId,
    createdBy: { id: row.createdBy, name: creator?.name ?? "" },
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function defaultOwnershipAt(
  productId: string,
  at: Date,
  tx?: DbOrTx,
): Promise<OwnershipVersionView | null> {
  if (tx === undefined) throw new TypeError("defaultOwnershipAt needs a database handle");
  const [atInstant] = await tx
    .select()
    .from(productOwnerships)
    .where(
      and(
        eq(productOwnerships.productId, productId),
        inArray(productOwnerships.status, ["active", "superseded"]),
        lte(productOwnerships.effectiveFrom, at),
      ),
    )
    .orderBy(desc(productOwnerships.effectiveFrom), desc(productOwnerships.version))
    .limit(1);
  if (atInstant !== undefined) return withLines(atInstant, tx);
  const [active] = await tx
    .select()
    .from(productOwnerships)
    .where(and(eq(productOwnerships.productId, productId), eq(productOwnerships.status, "active")))
    .limit(1);
  return active === undefined ? null : withLines(active, tx);
}

export const INR_RATE = "1.00000000";

export async function defaultRateToInr(
  currency: Currency,
  asOf: Date,
  tx: DbOrTx,
): Promise<string> {
  if (currency === "INR") return INR_RATE;
  const day = isoDate(asOf);
  const [row] = await tx
    .select({ rate: fxRates.rate })
    .from(fxRates)
    .where(
      and(
        eq(fxRates.base, currency),
        eq(fxRates.quote, "INR"),
        lte(fxRates.asOf, sql`${day}::date`),
      ),
    )
    .orderBy(desc(fxRates.asOf))
    .limit(1);
  if (row !== undefined) return row.rate;
  return (await getRate(currency, "INR", asOf)).rate;
}

export const defaultAuditLog: AuditService["log"] = async (
  actor,
  action,
  subject,
  before,
  after,
  tx: TxCtx,
) => {
  const entry = auditEntryFromActor(actor, action, subject, before, after);
  const [row] = await tx
    .insert(auditLogs)
    .values({
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: entry.ip,
      userAgent: entry.userAgent,
      requestId: entry.requestId,
    })
    .returning({ id: auditLogs.id });
  if (row === undefined) throw new Error("audit insert returned no row");
  return { auditLogId: row.id };
};
