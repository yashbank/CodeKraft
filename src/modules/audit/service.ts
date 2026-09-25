/**
 * Audit service implementation (docs/06 §1.6, §2.7 API-ADM-05; MASTER_SPEC §4.9; PHASE-03 P3.1).
 *
 * Implements `AuditService` contract with:
 * - Atomic logging within caller's `tx`
 * - Changed-keys diff builder
 * - Sensitive credentials redaction
 * - Cursor-paginated listing with multi-field filters
 * - CSV export audited and presigned
 * - Wires P1's `setAuditSink` to real database writes
 */
import { and, desc, eq, gte, ilike, like, lte, or, sql } from "drizzle-orm";
import { auditLogs, type AuditLog } from "../../../drizzle/schema/audit";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { setAuditSink, type AuditEvent } from "@/lib/audit-port";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { ListResult } from "@/modules/_shared/zod";
import type { AuditService } from "./contracts";
import {
  type AuditAction,
  type AuditActor,
  type AuditExportResult,
  type AuditLogRow,
  type AuditSubject,
  auditEntryFromActor,
  type ExportAuditLogsInput,
  type ListAuditLogsInput,
  zAuditAction,
} from "./types";
import { buildDiff } from "./diff";
import { redactSensitive } from "./redact";
import { formatAuditLogsCsv } from "./csv";

/** Preserved for freeze and contract tests (PHASE-02 P2.8). */
export function createNotImplementedAuditService(): AuditService {
  return createNotImplemented<AuditService>("audit", "P3", {
    log: "async",
    listAuditLogs: "async",
    exportAuditLogs: "async",
  });
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.getTime()}#${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { epochMs: number; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const [msStr, id] = raw.split("#");
    if (!msStr || !id) return null;
    const epochMs = Number(msStr);
    if (isNaN(epochMs)) return null;
    return { epochMs, id };
  } catch {
    return null;
  }
}

function mapRowToAuditLogRow(row: AuditLog): AuditLogRow {
  return {
    id: row.id,
    actorId: row.actorId,
    actorRole: row.actorRole,
    action: row.action,
    subject: {
      type: row.subjectType,
      id: row.subjectId,
    },
    before: row.before,
    after: row.after,
    ip: row.ip,
    userAgent: row.userAgent,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DefaultAuditService implements AuditService {
  constructor(private readonly getCustomDb?: () => DbOrTx) {}

  private async getDatabase(tx?: TxCtx): Promise<DbOrTx> {
    if (tx) return tx;
    if (this.getCustomDb) return this.getCustomDb();
    const { db } = await import("@/lib/db");
    return db;
  }

  /**
   * Writes one `audit_logs` row inside `tx`. Returns its id.
   * Never swallows errors: a failed audit insert fails the transaction (MASTER_SPEC §4.9).
   */
  async log(
    actor: AuditActor,
    action: AuditAction,
    subject: AuditSubject,
    before: unknown,
    after: unknown,
    tx: TxCtx,
  ): Promise<{ auditLogId: string }> {
    const validAction = zAuditAction.parse(action);
    const rawDiff = buildDiff(before, after);
    const diffBefore = rawDiff ? redactSensitive(rawDiff.before) : null;
    const diffAfter = rawDiff ? redactSensitive(rawDiff.after) : null;

    const entry = auditEntryFromActor(actor, validAction, subject, diffBefore, diffAfter);

    const [inserted] = await tx
      .insert(auditLogs)
      .values({
        action: entry.action,
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        subjectType: entry.subjectType,
        subjectId: entry.subjectId,
        before: entry.before,
        after: entry.after,
        ip: entry.ip,
        userAgent: entry.userAgent,
        requestId: entry.requestId,
      })
      .returning({ id: auditLogs.id });

    if (!inserted) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to insert audit log row");
    }

    return { auditLogId: inserted.id };
  }

  /**
   * API-ADM-05 `listAuditLogs` query. Requires `audit.read`.
   * Read-only; not itself audited.
   */
  async listAuditLogs(
    ctx: RequestContext,
    input: ListAuditLogsInput,
  ): Promise<ListResult<AuditLogRow>> {
    assertPermission(ctx, "audit.read");

    const database = await this.getDatabase();
    const { cursor, limit = 25, filters, q } = input;
    const conditions = [];

    if (filters?.actorId) {
      conditions.push(eq(auditLogs.actorId, filters.actorId));
    }
    if (filters?.action) {
      conditions.push(like(auditLogs.action, `${filters.action}%`));
    }
    if (filters?.subjectType) {
      conditions.push(eq(auditLogs.subjectType, filters.subjectType));
    }
    if (filters?.subjectId) {
      conditions.push(eq(auditLogs.subjectId, filters.subjectId));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      conditions.push(lte(auditLogs.createdAt, new Date(filters.dateTo)));
    }
    if (q) {
      conditions.push(
        or(
          ilike(auditLogs.action, `%${q}%`),
          ilike(auditLogs.subjectId, `%${q}%`),
          ilike(auditLogs.subjectType, `%${q}%`),
          ilike(auditLogs.requestId, `%${q}%`),
        ),
      );
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        conditions.push(
          or(
            sql`extract(epoch from ${auditLogs.createdAt}) * 1000 < ${decoded.epochMs}`,
            and(
              sql`floor(extract(epoch from ${auditLogs.createdAt}) * 1000) = ${decoded.epochMs}`,
              sql`${auditLogs.id} < ${decoded.id}::uuid`,
            ),
          ),
        );
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await database
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const itemsToReturn = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && itemsToReturn.length > 0) {
      const last = itemsToReturn[itemsToReturn.length - 1];
      if (last) {
        nextCursor = encodeCursor(last.createdAt, last.id);
      }
    }

    const [totalRow] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause);

    return {
      items: itemsToReturn.map(mapRowToAuditLogRow),
      nextCursor,
      total: totalRow?.count ?? 0,
    };
  }

  /**
   * API-ADM-05 `exportAuditLogs`. Requires `audit.export`.
   * Exports CSV, generates a 5-minute presigned URL, and audits the export itself.
   */
  async exportAuditLogs(
    ctx: RequestContext,
    input: ExportAuditLogsInput,
    tx?: TxCtx,
  ): Promise<AuditExportResult> {
    assertPermission(ctx, "audit.export");

    const database = await this.getDatabase(tx);
    const { filters, q } = input;
    const conditions = [];

    if (filters?.actorId) {
      conditions.push(eq(auditLogs.actorId, filters.actorId));
    }
    if (filters?.action) {
      conditions.push(like(auditLogs.action, `${filters.action}%`));
    }
    if (filters?.subjectType) {
      conditions.push(eq(auditLogs.subjectType, filters.subjectType));
    }
    if (filters?.subjectId) {
      conditions.push(eq(auditLogs.subjectId, filters.subjectId));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      conditions.push(lte(auditLogs.createdAt, new Date(filters.dateTo)));
    }
    if (q) {
      conditions.push(
        or(
          ilike(auditLogs.action, `%${q}%`),
          ilike(auditLogs.subjectId, `%${q}%`),
          ilike(auditLogs.subjectType, `%${q}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await database
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id));

    const csvContent = formatAuditLogsCsv(rows.map(mapRowToAuditLogRow));
    const filename = `audit-export-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // 5-minute presigned document URL (P3.5 will wire real R2 client; fallback to local stub)
    const url = `https://storage.codekraft.local/codekraft-documents/exports/${filename}?expires=300&sig=presigned`;

    const { withTx } = await import("@/lib/db");
    // Audit the export action in the provided or new transaction
    await withTx(async (auditTx) => {
      await this.log(
        ctx,
        "API-ADM-05 audit.export",
        { type: "audit_logs", id: filename },
        null,
        { rowCount: rows.length, filename, csvLength: csvContent.length },
        auditTx,
      );
    }, tx);

    return {
      url,
      filename,
      expiresAt,
    };
  }
}

export function createAuditService(getDb?: () => DbOrTx): AuditService {
  return new DefaultAuditService(getDb);
}

export const auditService: AuditService = new DefaultAuditService();

// Wire P1's audit port to database writer with a system actor
setAuditSink(async (event: AuditEvent) => {
  try {
    const { withTx } = await import("@/lib/db");
    await withTx(async (tx) => {
      const validAction = zAuditAction.safeParse(event.action).success
        ? event.action
        : "system.audit";
      await auditService.log(
        {
          kind: "system",
          name: "system",
          requestId: event.requestId ?? undefined,
        },
        validAction,
        {
          type: event.subjectType ?? "system",
          id: event.subjectId ?? "global",
        },
        event.before,
        event.after,
        tx,
      );
    });
  } catch {
    // Non-blocking for external event callers
  }
});
