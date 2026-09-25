/**
 * Sibling-service ports used by the P6 domain modules (notifications, leads, queries).
 *
 * The audit (P3.1) and analytics (P6.8) services are implemented concurrently; the ports below
 * resolve the real singleton lazily by its conventional export name and otherwise write the same
 * row directly inside the caller's transaction, so MASTER_SPEC §4.9 (audit in the same tx) holds
 * either way. Services take the ports as dependencies so unit tests inject fakes.
 */
import type { TxCtx } from "@/lib/db";
import { moduleLogger } from "@/lib/logger";
import type { AnalyticsService } from "@/modules/analytics/contracts";
import type { ServerAnalyticsEvent } from "@/modules/analytics/types";
import type { AuditService } from "@/modules/audit/contracts";
import { type AuditActor, auditEntryFromActor } from "@/modules/audit/types";
import { auditLogs } from "../../../drizzle/schema/audit";
import { analyticsEvents } from "../../../drizzle/schema/ops";

export type AuditLog = AuditService["log"];
export interface AuditPort {
  log: AuditLog;
}
export type RecordServerEvent = AnalyticsService["recordServerEvent"];
export interface AnalyticsPort {
  recordServerEvent: RecordServerEvent;
}

const log = moduleLogger("p6.ports");

export function isNotImplemented(err: unknown): boolean {
  return err instanceof Error && /not implemented \(P\d/.test(err.message);
}

async function loadExport<T>(loader: () => Promise<unknown>, name: string): Promise<T | undefined> {
  try {
    const mod = (await loader()) as Record<string, unknown>;
    const value = mod[name];
    return value === undefined ? undefined : (value as T);
  } catch {
    return undefined;
  }
}

/** Direct `audit_logs` insert inside `tx` (same row shape as the audit module's sink). */
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

/** `audit.log` through `modules/audit` when implemented, else `directAuditLog`. */
export function lazyAuditPort(): AuditPort {
  return {
    async log(actor, action, subject, before, after, tx) {
      const real = await loadExport<AuditService>(
        () => import("@/modules/audit/service"),
        "auditService",
      );
      if (real !== undefined) {
        try {
          return await real.log(actor, action, subject, before, after, tx);
        } catch (err) {
          if (!isNotImplemented(err)) throw err;
        }
      }
      return directAuditLog(actor, action, subject, before, after, tx);
    },
  };
}

/** Direct `analytics_events` insert inside `tx`. */
export const directRecordServerEvent: RecordServerEvent = async (
  event: ServerAnalyticsEvent,
  tx: TxCtx,
) => {
  await tx.insert(analyticsEvents).values({
    name: event.name,
    userId: event.userId ?? null,
    anonId: event.anonId ?? null,
    productId: event.productId ?? null,
    orderId: event.orderId ?? null,
    props: event.props ?? null,
  });
};

/** `analytics.recordServerEvent` through `modules/analytics` when implemented, else direct insert. */
export function lazyAnalyticsPort(): AnalyticsPort {
  return {
    async recordServerEvent(event, tx) {
      const real = await loadExport<AnalyticsService>(
        () => import("@/modules/analytics/service"),
        "analyticsService",
      );
      if (real !== undefined) {
        try {
          await real.recordServerEvent(event, tx);
          return;
        } catch (err) {
          if (!isNotImplemented(err)) {
            // Analytics is best-effort (D-1302): never fail the domain write for it.
            log.warn({ err, event: event.name }, "analytics recordServerEvent failed; skipped");
            return;
          }
        }
      }
      await directRecordServerEvent(event, tx);
    },
  };
}
