/**
 * Audit service contract (docs/06 §1.6, §2.7 API-ADM-05; master plan §5
 * `audit.log(actor, action, subject, before, after, tx)`). Replaces the P1 port
 * (`src/lib/audit-port.ts`): P2.8 wires `setAuditSink` to `log` with a system actor.
 *
 * `log` inserts inside the caller's `tx` so the row is atomic with the domain mutation
 * (MASTER_SPEC §4.9); it never swallows errors — a failed audit insert fails the transaction.
 */
import type { TxCtx } from "@/lib/db";
import type { RequestContext } from "@/lib/authz/context";
import type { ListResult } from "@/modules/_shared/zod";
import type {
  AuditAction,
  AuditActor,
  AuditExportResult,
  AuditLogRow,
  AuditSubject,
  ExportAuditLogsInput,
  ListAuditLogsInput,
} from "./types";

export interface AuditService {
  /** Write one `audit_logs` row inside `tx`; returns its id. */
  log(
    actor: AuditActor,
    action: AuditAction,
    subject: AuditSubject,
    before: unknown,
    after: unknown,
    tx: TxCtx,
  ): Promise<{ auditLogId: string }>;

  /** API-ADM-05 `listAuditLogs` (query) — `audit.read`; read-only, not itself audited. */
  listAuditLogs(ctx: RequestContext, input: ListAuditLogsInput): Promise<ListResult<AuditLogRow>>;

  /** API-ADM-05 `exportAuditLogs` — `audit.export`; CSV to R2, presigned URL; audited. */
  exportAuditLogs(
    ctx: RequestContext,
    input: ExportAuditLogsInput,
    tx?: TxCtx,
  ): Promise<AuditExportResult>;
}

/** Master plan §5 method names, for the P2.8 freeze / fixture test. */
export const AUDIT_CONTRACT_METHODS = ["log"] as const satisfies readonly (keyof AuditService)[];
