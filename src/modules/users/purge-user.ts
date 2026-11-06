/**
 * Permanent user delete (customers and removed admins).
 *
 * One transaction: rows that only exist for this person (downloads, entitlements, quotes made for
 * them) are deleted; records they authored (products, approvals, ledger lines, ...) are handed to
 * the acting admin so history stays intact; orders, leads and queries are kept anonymised by their
 * `ON DELETE SET NULL` foreign keys. The users row is then deleted (sessions, accounts and roles
 * cascade), which frees the email for a fresh invite.
 *
 * Every non-cascading foreign key to `users` is listed below; a test reads pg_constraint and fails
 * when a new one is added without being handled here.
 */
import { and, count, eq, ne, sql } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { auditLogs } from "../../../drizzle/schema/audit";
import { userRoles, users } from "../../../drizzle/schema/auth";
import { partners } from "../../../drizzle/schema/users-ext";

/** `table.column` pairs whose rows belong to the person and are deleted with them. */
export const PURGE_OWNED_COLUMNS = [
  "downloads.user_id",
  "entitlements.user_id",
  "custom_quotes.customer_id",
] as const;

/** NOT NULL `table.column` pairs reassigned to the acting admin. */
export const PURGE_REASSIGN_COLUMNS = [
  "approval_decisions.decided_by",
  "approval_requests.requested_by",
  "ledger_entries.created_by",
  "legal_page_versions.published_by",
  "media.uploaded_by",
  "product_blogs.author_id",
  "product_ownerships.created_by",
  "product_versions.created_by",
  "products.created_by",
  "products.updated_by",
] as const;

/** Nullable `table.column` pairs set to NULL. */
export const PURGE_NULL_COLUMNS = [
  "coupons.created_by",
  "custom_quotes.created_by",
  "delivery_tasks.assigned_to",
  "entitlements.granted_manually_by",
  "expenses.created_by",
  "orders.created_by",
  "payments.confirmed_by",
  "payouts.recorded_by",
  "refunds.executed_by",
  "service_progress.done_by",
  "user_roles.granted_by",
] as const;

/** Handled by the partner-row step instead. */
export const PURGE_PARTNER_COLUMNS = ["partners.user_id"] as const;

/** Append-only / frozen guard triggers that would block the reassignment (and the audit SET NULL). */
const GUARDED_TABLES = [
  "audit_logs",
  "ledger_entries",
  "payouts",
  "payments",
  "approval_decisions",
] as const;

const ident = (name: string) => sql.identifier(name);
const split = (pair: string): [string, string] => {
  const [table = "", column = ""] = pair.split(".");
  return [table, column];
};

export interface PurgeUserInput {
  targetId: string;
  /** Admin who performs (or approved) the delete; receives records the person authored. */
  actorId: string;
  actorRole?: string | null;
}

export interface PurgeUserResult {
  email: string;
  name: string;
  roles: string[];
}

async function partnerBlockers(tx: DbOrTx, partnerId: string): Promise<string[]> {
  const out: string[] = [];
  const checks: Array<[string, string]> = [
    ["payouts", "payouts"],
    ["ledger_entries", "ledger entries"],
    ["product_ownership_lines", "product ownership shares"],
  ];
  for (const [table, label] of checks) {
    const rows = await tx.execute<{ n: string }>(
      sql`select count(*)::text as n from ${ident(table)} where partner_id = ${partnerId}`,
    );
    if (Number([...rows][0]?.n ?? 0) > 0) out.push(label);
  }
  return out;
}

/** Blockers only; used at request time so the admin sees the reason before approving. */
export async function purgeBlockers(tx: DbOrTx, targetId: string): Promise<string | null> {
  const [partner] = await tx
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.userId, targetId))
    .limit(1);
  if (!partner) return null;
  const blockers = await partnerBlockers(tx, partner.id);
  if (blockers.length === 0) return null;
  return `This partner still has ${blockers.join(", ")}. Wipe or reassign those first, then delete the account.`;
}

export async function purgeUser(tx: TxCtx, input: PurgeUserInput): Promise<PurgeUserResult> {
  const { targetId, actorId } = input;
  if (targetId === actorId) {
    throw new AppError(ErrorCode.STATE_INVALID, "You cannot delete your own account.");
  }

  const [target] = await tx.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) throw new AppError(ErrorCode.NOT_FOUND, "User not found");

  const roles = (
    await tx
      .select({ roleKey: userRoles.roleKey })
      .from(userRoles)
      .where(eq(userRoles.userId, targetId))
  ).map((r) => r.roleKey as string);

  if (roles.includes("super_admin")) {
    const [others] = await tx
      .select({ n: count() })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(
        and(
          eq(userRoles.roleKey, "super_admin"),
          eq(users.status, "active"),
          ne(users.id, targetId),
        ),
      );
    if (Number(others?.n ?? 0) < 1) {
      throw new AppError(ErrorCode.STATE_INVALID, "Cannot delete the last super admin.");
    }
  }

  const [partner] = await tx
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.userId, targetId))
    .limit(1);
  if (partner) {
    const blockers = await partnerBlockers(tx, partner.id);
    if (blockers.length > 0) {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        `This partner still has ${blockers.join(", ")}. Wipe or reassign those first, then delete the account.`,
      );
    }
  }

  for (const t of GUARDED_TABLES)
    await tx.execute(sql`ALTER TABLE ${ident(t)} DISABLE TRIGGER USER`);

  // Quotes made for the person go with them; an order that points at one keeps existing without it.
  await tx.execute(
    sql`update orders set custom_quote_id = null where custom_quote_id in (select id from custom_quotes where customer_id = ${targetId})`,
  );
  for (const pair of PURGE_OWNED_COLUMNS) {
    const [table, column] = split(pair);
    await tx.execute(sql`delete from ${ident(table)} where ${ident(column)} = ${targetId}`);
  }
  // One decision per admin per request: where the actor already decided, the old decision is dropped.
  await tx.execute(
    sql`delete from approval_decisions where decided_by = ${targetId} and request_id in (select request_id from approval_decisions where decided_by = ${actorId})`,
  );
  for (const pair of PURGE_REASSIGN_COLUMNS) {
    const [table, column] = split(pair);
    await tx.execute(
      sql`update ${ident(table)} set ${ident(column)} = ${actorId} where ${ident(column)} = ${targetId}`,
    );
  }
  for (const pair of PURGE_NULL_COLUMNS) {
    const [table, column] = split(pair);
    await tx.execute(
      sql`update ${ident(table)} set ${ident(column)} = null where ${ident(column)} = ${targetId}`,
    );
  }
  if (partner) await tx.delete(partners).where(eq(partners.id, partner.id));
  await tx.delete(users).where(eq(users.id, targetId));

  await tx.insert(auditLogs).values({
    actorId,
    actorRole: input.actorRole ?? null,
    action: "user.purged",
    subjectType: "user",
    subjectId: targetId,
    before: { email: target.email, roles },
    after: null,
  });

  for (const t of GUARDED_TABLES)
    await tx.execute(sql`ALTER TABLE ${ident(t)} ENABLE TRIGGER USER`);

  return { email: target.email, name: target.name, roles };
}
