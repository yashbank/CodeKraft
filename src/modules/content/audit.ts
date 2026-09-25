/**
 * Audit port for the content and blog services (docs/06 §1.6, MASTER_SPEC §4.9, D-1104).
 *
 * The frozen `AuditService.log(actor, action, subject, before, after, tx)` is the contract; the
 * P3.1 module owns the implementation. Until its singleton exists the fallback below writes the
 * same `audit_logs` row through `auditEntryFromActor` (frozen `audit/types.ts`) inside the
 * caller's transaction, so atomicity holds either way. Services take the port as a dependency,
 * so unit tests pass a fake.
 */
import type { TxCtx } from "@/lib/db";
import { auditLogs } from "../../../drizzle/schema/audit";
import type { AuditService } from "../audit/contracts";
import { type AuditActor, auditEntryFromActor } from "../audit/types";

export type AuditLog = AuditService["log"];

export interface AuditPort {
  log: AuditLog;
}

/** Direct `audit_logs` insert (same row shape as the P2.8 minimal sink). */
export const directAuditLog: AuditLog = async (actor, action, subject, before, after, tx) => {
  const entry = auditEntryFromActor(actor as AuditActor, action, subject, before, after);
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
  if (row === undefined) throw new Error("audit_logs insert returned no row");
  return { auditLogId: row.id };
};

let resolved: Promise<AuditLog> | undefined;

/**
 * The audit module's singleton `auditService.log` when `src/modules/audit/service.ts` exports one
 * (P3.1), otherwise `directAuditLog`. Resolved once per process.
 */
export function resolveAuditLog(): Promise<AuditLog> {
  resolved ??= import("../audit/service")
    .then((mod: Record<string, unknown>) => {
      const svc = mod["auditService"] as { log?: unknown } | undefined;
      if (svc !== undefined && typeof svc.log === "function") {
        return ((...args: Parameters<AuditLog>) => (svc.log as AuditLog)(...args)) as AuditLog;
      }
      return directAuditLog;
    })
    .catch(() => directAuditLog);
  return resolved;
}

/** Port that defers to `resolveAuditLog()` on every call (the production default for services). */
export const auditPort: AuditPort = {
  log: async (actor, action, subject, before, after, tx: TxCtx) =>
    (await resolveAuditLog())(actor, action, subject, before, after, tx),
};

/** Test helper: reset the memoised resolution (e.g. after mocking the audit module). */
export function resetAuditResolution(): void {
  resolved = undefined;
}
