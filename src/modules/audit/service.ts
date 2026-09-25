/**
 * `audit` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `AuditService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { AuditService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "audit.<method> not implemented (P3)")`. */
export function createNotImplementedAuditService(): AuditService {
  return createNotImplemented<AuditService>("audit", "P3", {
    log: "async",
    listAuditLogs: "async",
    exportAuditLogs: "async",
  });
}
