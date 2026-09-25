/**
 * Bridge from the P1 `src/lib/audit-port` (`AuditEvent`) to the real `audit_logs` writer.
 * `src/lib/bootstrap.ts` calls `installAuditSink()` once at startup so Better Auth hooks and
 * layouts write real rows (PHASE-03 P3.1 "wire the audit port").
 */
import { type AuditSink, setAuditSink } from "@/lib/audit-port";
import type { AuditServiceImpl } from "./service";

export function auditSinkFor(service: Pick<AuditServiceImpl, "writeEvent">): AuditSink {
  return async (event) => {
    await service.writeEvent(event);
  };
}

export function installAuditSink(service: Pick<AuditServiceImpl, "writeEvent">): void {
  setAuditSink(auditSinkFor(service));
}
