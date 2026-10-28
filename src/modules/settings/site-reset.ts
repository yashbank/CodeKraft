/**
 * "Reset site data" (P6-05): preview, backup, request and the approved wipe. Super admin only;
 * the wipe runs ONLY as the `site.reset` approval apply handler, in the approval's transaction,
 * after a different super admin approved (approvals service enforces requester != approver).
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission, hasRole } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import {
  RESET_CATEGORIES,
  countSql,
  deleteSql,
  expandCategories,
  quoteIdent,
  selectSql,
  stepsFor,
  type ResetCategory,
} from "./site-reset-plan";

/** Minimal SQL runner so the wipe is testable without a database. */
export interface ResetDb {
  run(text: string): Promise<Record<string, unknown>[]>;
}
export const resetDbFrom = (tx: TxCtx): ResetDb => ({
  run: async (text) => [...(await tx.execute(sql.raw(text)))] as Record<string, unknown>[],
});

export const siteResetInput = z
  .object({
    categories: z.array(z.enum(RESET_CATEGORIES)).min(1),
    confirmName: z.string(),
  })
  .strict();

export function assertSuperAdmin(ctx: RequestContext): void {
  assertPermission(ctx, "settings.write");
  if (!hasRole(ctx, "super_admin")) throw new AppError(ErrorCode.FORBIDDEN);
}

/** Row counts per table that the wipe would delete (read-only). */
export async function previewCounts(
  db: ResetDb,
  categories: readonly ResetCategory[],
): Promise<{ table: string; count: number }[]> {
  const out: { table: string; count: number }[] = [];
  for (const st of stepsFor(categories)) {
    const [row] = await db.run(countSql(st));
    out.push({ table: st.table, count: Number(row?.c ?? 0) });
  }
  return out;
}

/** Auth secrets (password hashes, tokens, 2FA) are never put in a downloadable backup. */
const BACKUP_SKIP = new Set(["accounts", "sessions", "two_factor"]);

export async function backupJson(
  db: ResetDb,
  categories: readonly ResetCategory[],
): Promise<string> {
  const tables: Record<string, unknown[]> = {};
  for (const st of stepsFor(categories)) {
    if (!BACKUP_SKIP.has(st.table)) tables[st.table] = await db.run(selectSql(st));
  }
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), categories: expandCategories(categories), tables },
    null,
    2,
  );
}

/** Deletes in FK-safe order inside the caller's transaction; returns rows deleted per table. */
export async function runReset(
  db: ResetDb,
  categories: readonly ResetCategory[],
): Promise<{ table: string; count: number }[]> {
  const steps = stepsFor(categories);
  // Append-only / frozen guard triggers must be off for the wipe; re-enabled in the same tx.
  for (const st of steps) await db.run(`ALTER TABLE ${quoteIdent(st.table)} DISABLE TRIGGER USER`);
  const counts = await previewCounts(db, categories);
  for (const st of steps) await db.run(deleteSql(st));
  for (const st of steps) await db.run(`ALTER TABLE ${quoteIdent(st.table)} ENABLE TRIGGER USER`);
  return counts;
}

export interface RequestDeps {
  siteName: () => Promise<string>;
  /** Creates the approval + audit entry in one transaction; returns the approval id. */
  create: (ctx: RequestContext, categories: ResetCategory[]) => Promise<string>;
}

export async function requestSiteReset(
  ctx: RequestContext,
  raw: unknown,
  deps: RequestDeps,
): Promise<{ approvalRequestId: string; categories: ResetCategory[] }> {
  assertSuperAdmin(ctx);
  const input = siteResetInput.parse(raw);
  if (input.confirmName !== (await deps.siteName())) {
    throw new AppError(ErrorCode.VALIDATION, "Type the exact site name to confirm");
  }
  const categories = expandCategories(input.categories);
  return { approvalRequestId: await deps.create(ctx, categories), categories };
}
