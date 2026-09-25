/**
 * `audit` service (PHASE-03 P3.1; docs/06 §1.6, §2.7 API-ADM-05; MASTER_SPEC §4.9, §7 "Audit
 * atomicity"; D-1104).
 *
 * - `log` writes one `audit_logs` row inside the caller's transaction, redacting secrets in
 *   `before`/`after`; a failed insert fails the transaction.
 * - `listAuditLogs` / `exportAuditLogs` are the API-ADM-05 read models; the export writes a CSV to
 *   the documents bucket and returns a 5-minute presigned URL, auditing itself in the same tx.
 * - `writeEvent` is the `src/lib/audit-port` sink (auth hooks, layouts); `exportForRetention`
 *   is the weekly `audit.export` copy (docs/09 §5.3).
 */
import { and, asc, desc, eq, gt, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import type { AuditEvent } from "@/lib/audit-port";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { type DbOrTx, type TxCtx, getDb } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { newId } from "@/lib/ids";
import type { ListResult } from "@/modules/_shared/zod";
import { auditLogs } from "../../../drizzle/schema/audit";
import { getDefaultBuckets, getDefaultStorage, type StorageClient } from "@/modules/media/storage";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { AuditService } from "./contracts";
import { toCsv } from "./csv";
import { redact } from "./redact";
import { runInTx } from "./tx";
import {
  type AuditAction,
  type AuditActor,
  type AuditExportResult,
  type AuditLogRow,
  type AuditSubject,
  type ExportAuditLogsInput,
  type ListAuditLogsInput,
  auditEntryFromActor,
  zAuditAction,
} from "./types";

export interface AuditDeps {
  db: () => DbOrTx;
  storage: () => StorageClient;
  /** Bucket for CSV exports (`codekraft-documents`, docs/12 §6). */
  documentsBucket: () => string;
  now?: () => Date;
  newId?: () => string;
}

/** Hard cap on rows per CSV export (D-1104: exports are filtered, not full dumps). */
export const AUDIT_EXPORT_MAX_ROWS = 50_000;
export const AUDIT_EXPORT_URL_TTL_SECONDS = 300;
/** `total` is returned only for filtered sets below this size (docs/06 §1.8). */
export const AUDIT_LIST_TOTAL_CAP = 10_000;

export const AUDIT_CSV_HEADER = [
  "id",
  "created_at",
  "actor_id",
  "actor_role",
  "action",
  "subject_type",
  "subject_id",
  "before",
  "after",
  "ip",
  "user_agent",
  "request_id",
] as const;

export interface AuditServiceImpl extends AuditService {
  /** `src/lib/audit-port` sink: writes an `AuditEvent` in its own transaction (or `tx`). */
  writeEvent(event: AuditEvent, tx?: DbOrTx): Promise<{ auditLogId: string }>;
  /** Weekly append-only copy of `audit_logs` to `exports/audit/<weekEnding>.csv` (docs/09 §5.3). */
  exportForRetention(
    weekEnding: string,
    tx?: DbOrTx,
  ): Promise<{ objectKey: string; rowCount: number }>;
}

type AuditRowSelect = typeof auditLogs.$inferSelect;

function toRow(r: AuditRowSelect): AuditLogRow {
  return {
    id: r.id,
    actorId: r.actorId,
    actorRole: r.actorRole,
    action: r.action,
    subject: { type: r.subjectType, id: r.subjectId },
    before: r.before ?? null,
    after: r.after ?? null,
    ip: r.ip,
    userAgent: r.userAgent,
    requestId: r.requestId,
    createdAt: r.createdAt.toISOString(),
  };
}

interface Cursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.createdAt, c.id]), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): Cursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string" &&
      !Number.isNaN(Date.parse(parsed[0]))
    ) {
      return { createdAt: parsed[0], id: parsed[1] };
    }
  } catch {
    // fall through
  }
  throw new AppError(ErrorCode.VALIDATION, "invalid cursor", {
    fieldErrors: { cursor: ["invalid cursor"] },
  });
}

/** `dateTo` is inclusive of the whole day (`YYYY-MM-DD` → `< next day`). */
function endOfDay(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000);
}

export function buildFilters(
  filters: ListAuditLogsInput["filters"] | ExportAuditLogsInput["filters"],
  q: string | undefined,
): SQL[] {
  const where: SQL[] = [];
  if (filters?.actorId !== undefined) where.push(eq(auditLogs.actorId, filters.actorId));
  if (filters?.action !== undefined) where.push(ilike(auditLogs.action, `${escapeLike(filters.action)}%`));
  if (filters?.subjectType !== undefined) where.push(eq(auditLogs.subjectType, filters.subjectType));
  if (filters?.subjectId !== undefined) where.push(eq(auditLogs.subjectId, filters.subjectId));
  if (filters?.dateFrom !== undefined) {
    where.push(gte(auditLogs.createdAt, new Date(`${filters.dateFrom}T00:00:00.000Z`)));
  }
  if (filters?.dateTo !== undefined) where.push(lt(auditLogs.createdAt, endOfDay(filters.dateTo)));
  if (q !== undefined && q !== "") {
    const needle = `%${escapeLike(q)}%`;
    const clause = or(
      ilike(auditLogs.action, needle),
      ilike(auditLogs.subjectType, needle),
      ilike(auditLogs.subjectId, needle),
      ilike(auditLogs.actorRole, needle),
      ilike(auditLogs.requestId, needle),
    );
    if (clause !== undefined) where.push(clause);
  }
  return where;
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export function createAuditService(deps: AuditDeps): AuditServiceImpl {
  const now = deps.now ?? (() => new Date());
  const mkId = deps.newId ?? newId;

  async function insertRow(
    tx: TxCtx,
    entry: {
      action: string;
      actorId: string | null;
      actorRole: string | null;
      subjectType: string;
      subjectId: string;
      before: unknown;
      after: unknown;
      ip: string | null;
      userAgent: string | null;
      requestId: string | null;
    },
  ): Promise<{ auditLogId: string }> {
    const [row] = await tx
      .insert(auditLogs)
      .values({
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        subjectType: entry.subjectType,
        subjectId: entry.subjectId,
        before: entry.before === undefined ? null : redact(entry.before),
        after: entry.after === undefined ? null : redact(entry.after),
        ip: entry.ip,
        userAgent: entry.userAgent,
        requestId: entry.requestId,
      })
      .returning({ id: auditLogs.id });
    if (row === undefined) throw new AppError(ErrorCode.INTERNAL, "audit insert returned no row");
    return { auditLogId: row.id };
  }

  async function log(
    actor: AuditActor,
    action: AuditAction,
    subject: AuditSubject,
    before: unknown,
    after: unknown,
    tx: TxCtx,
  ): Promise<{ auditLogId: string }> {
    const parsed = zAuditAction.safeParse(action);
    if (!parsed.success) {
      throw new AppError(ErrorCode.INTERNAL, `invalid audit action: ${action}`);
    }
    const entry = auditEntryFromActor(actor, parsed.data, subject, before, after);
    return insertRow(tx, entry);
  }

  async function writeEvent(event: AuditEvent, tx?: DbOrTx): Promise<{ auditLogId: string }> {
    const meta = event.meta === undefined ? {} : { meta: event.meta };
    const after =
      event.after === undefined
        ? Object.keys(meta).length === 0
          ? null
          : meta
        : typeof event.after === "object" && event.after !== null && !Array.isArray(event.after)
          ? { ...(event.after as Record<string, unknown>), ...meta }
          : event.after;
    return runInTx(tx ?? deps.db(), (t) =>
      insertRow(t, {
        action: event.action,
        actorId: event.actorId ?? null,
        actorRole: event.actorRole ?? null,
        subjectType: event.subjectType ?? "user",
        subjectId: event.subjectId ?? event.actorId ?? "-",
        before: event.before ?? null,
        after,
        ip: event.ip ?? null,
        userAgent: event.userAgent ?? null,
        requestId: event.requestId ?? null,
      }),
    );
  }

  async function listAuditLogs(
    ctx: RequestContext,
    input: ListAuditLogsInput,
  ): Promise<ListResult<AuditLogRow>> {
    assertPermission(ctx, "audit.read");
    const db = deps.db();
    const direction = input.sort === "createdAt:asc" ? "asc" : "desc";
    const where = buildFilters(input.filters, input.q);
    const filteredWhere = where.length === 0 ? undefined : and(...where);
    const pageWhere = [...where];
    if (input.cursor !== undefined) {
      const c = decodeCursor(input.cursor);
      const at = new Date(c.createdAt);
      const after =
        direction === "desc"
          ? or(lt(auditLogs.createdAt, at), and(eq(auditLogs.createdAt, at), lt(auditLogs.id, c.id)))
          : or(gt(auditLogs.createdAt, at), and(eq(auditLogs.createdAt, at), gt(auditLogs.id, c.id)));
      if (after !== undefined) pageWhere.push(after);
    }
    const order =
      direction === "desc"
        ? [desc(auditLogs.createdAt), desc(auditLogs.id)]
        : [asc(auditLogs.createdAt), asc(auditLogs.id)];
    const rows = await db
      .select()
      .from(auditLogs)
      .where(pageWhere.length === 0 ? undefined : and(...pageWhere))
      .orderBy(...order)
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > input.limit && last !== undefined
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;
    const result: ListResult<AuditLogRow> = { items: page.map(toRow), nextCursor };
    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(filteredWhere);
    if (count !== undefined && count.n < AUDIT_LIST_TOTAL_CAP) result.total = count.n;
    return result;
  }

  async function selectForExport(
    tx: TxCtx,
    where: SQL[],
    limit: number,
  ): Promise<AuditRowSelect[]> {
    return tx
      .select()
      .from(auditLogs)
      .where(where.length === 0 ? undefined : and(...where))
      .orderBy(asc(auditLogs.createdAt), asc(auditLogs.id))
      .limit(limit);
  }

  function rowsToCsv(rows: AuditRowSelect[]): string {
    return toCsv(
      AUDIT_CSV_HEADER,
      rows.map((r) => [
        r.id,
        r.createdAt.toISOString(),
        r.actorId,
        r.actorRole,
        r.action,
        r.subjectType,
        r.subjectId,
        r.before,
        r.after,
        r.ip,
        r.userAgent,
        r.requestId,
      ]),
    );
  }

  async function exportAuditLogs(
    ctx: RequestContext,
    input: ExportAuditLogsInput,
    tx?: DbOrTx,
  ): Promise<AuditExportResult> {
    assertPermission(ctx, "audit.export");
    return runInTx(tx ?? deps.db(), async (t) => {
      const rows = await selectForExport(t, buildFilters(input.filters, input.q), AUDIT_EXPORT_MAX_ROWS);
      const at = now();
      const stamp = at.toISOString().replace(/[:.]/g, "-");
      const filename = `audit-logs-${stamp}.csv`;
      const key = `exports/audit/${stamp}-${mkId()}.csv`;
      const bucket = deps.documentsBucket();
      const storage = deps.storage();
      await storage.putObject({ bucket, key, body: rowsToCsv(rows), contentType: "text/csv; charset=utf-8" });
      const url = await storage.presignGet({
        bucket,
        key,
        expiresInSeconds: AUDIT_EXPORT_URL_TTL_SECONDS,
        responseContentDisposition: `attachment; filename="${filename}"`,
      });
      const expiresAt = new Date(at.getTime() + AUDIT_EXPORT_URL_TTL_SECONDS * 1000).toISOString();
      await log(
        ctx,
        "API-ADM-05 audit.export",
        { type: "audit_export", id: key },
        null,
        { filename, objectKey: key, rowCount: rows.length, filters: input.filters ?? null, q: input.q ?? null, truncated: rows.length >= AUDIT_EXPORT_MAX_ROWS },
        t,
      );
      return { url, filename, expiresAt };
    });
  }

  async function exportForRetention(
    weekEnding: string,
    tx?: DbOrTx,
  ): Promise<{ objectKey: string; rowCount: number }> {
    const end = endOfDay(weekEnding);
    const start = new Date(end.getTime() - 7 * 86_400_000);
    return runInTx(tx ?? deps.db(), async (t) => {
      const rows = await t
        .select()
        .from(auditLogs)
        .where(and(gte(auditLogs.createdAt, start), lt(auditLogs.createdAt, end)))
        .orderBy(asc(auditLogs.createdAt), asc(auditLogs.id));
      const key = `exports/audit/weekly/${weekEnding}.csv`;
      await deps.storage().putObject({
        bucket: deps.documentsBucket(),
        key,
        body: rowsToCsv(rows),
        contentType: "text/csv; charset=utf-8",
      });
      await log(
        { kind: "system", name: "cron:audit.export" },
        "cron.audit.export",
        { type: "audit_export", id: key },
        null,
        { weekEnding, rowCount: rows.length, from: start.toISOString(), to: end.toISOString() },
        t,
      );
      return { objectKey: key, rowCount: rows.length };
    });
  }

  return { log, listAuditLogs, exportAuditLogs, writeEvent, exportForRetention };
}

export const auditService: AuditServiceImpl = createAuditService({
  db: () => getDb(),
  storage: () => getDefaultStorage(),
  documentsBucket: () => getDefaultBuckets().documents,
});

/** P2.8 skeleton kept for modules that still fall back to a NotImplemented audit port. */
export function createNotImplementedAuditService(): AuditService {
  return createNotImplemented<AuditService>("audit", "P3", {
    log: "async",
    listAuditLogs: "async",
    exportAuditLogs: "async",
  });
}
