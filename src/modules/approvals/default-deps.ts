/**
 * Default dependency resolution shared by the P3 services (approvals, catalog, offerings).
 *
 * Sibling modules land concurrently: `audit` (P3.1) and `notifications` (P6) may still be the
 * P2.8 NotImplemented stubs when this code first runs. The ports below resolve the real service
 * lazily by its conventional export name (`auditService`, `notificationsService`, …) at call
 * time and degrade explicitly when it is absent:
 *  - audit → `src/lib/audit-port.ts` (the P1 sink: logs, never throws) — the row is still
 *    emitted, just not through `audit_logs` until P3.1 wires `setAuditSink`;
 *  - notifications → logged and skipped (notifications are best-effort per contract).
 * Unit tests inject fakes; integration tests inject recording fakes.
 */
import { audit as auditPort } from "@/lib/audit-port";
import { moduleLogger } from "@/lib/logger";
import type { AuditService } from "@/modules/audit/contracts";
import { auditEntryFromActor } from "@/modules/audit/types";
import type { NotificationsService } from "@/modules/notifications/contracts";

export type AuditPort = Pick<AuditService, "log">;
export type NotificationsPort = Pick<NotificationsService, "emit">;

const log = moduleLogger("approvals.deps");

function isNotImplemented(err: unknown): boolean {
  return err instanceof Error && /not implemented \(P\d/.test(err.message);
}

async function loadExport<T>(loader: () => Promise<Record<string, unknown>>, name: string) {
  try {
    const mod = await loader();
    const value = mod[name];
    return value === undefined ? undefined : (value as T);
  } catch {
    return undefined;
  }
}

/** `audit.log` that uses `modules/audit` when implemented, else the P1 audit port. */
export function lazyAuditService(): AuditPort {
  return {
    async log(actor, action, subject, before, after, tx) {
      const real = await loadExport<AuditService>(
        () => import("@/modules/audit/service") as Promise<Record<string, unknown>>,
        "auditService",
      );
      if (real !== undefined) {
        try {
          return await real.log(actor, action, subject, before, after, tx);
        } catch (err) {
          if (!isNotImplemented(err)) throw err;
        }
      }
      await auditPort(auditEntryFromActor(actor, action, subject, before, after));
      return { auditLogId: "" };
    },
  };
}

/** `notifications.emit` that uses `modules/notifications` when implemented, else logs and skips. */
export function lazyNotificationsService(): NotificationsPort {
  return {
    async emit(target, type, payload, channels, tx, options) {
      const real = await loadExport<NotificationsService>(
        () => import("@/modules/notifications/service") as Promise<Record<string, unknown>>,
        "notificationsService",
      );
      if (real !== undefined) {
        try {
          return await real.emit(target, type, payload, channels, tx, options);
        } catch (err) {
          if (!isNotImplemented(err)) throw err;
        }
      }
      log.info({ type, target }, "notifications service not wired; skipped emit");
      return { notificationIds: [], recipients: [], emailOutboxIds: [] };
    },
  };
}

/** Generic lazy resolver for optional sibling services (catalog/offerings use it). */
export async function resolveSibling<T>(
  loader: () => Promise<unknown>,
  exportName: string,
): Promise<T | undefined> {
  return loadExport<T>(loader as () => Promise<Record<string, unknown>>, exportName);
}

export { isNotImplemented };
