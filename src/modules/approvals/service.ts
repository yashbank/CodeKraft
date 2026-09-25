/**
 * `approvals` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `ApprovalsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { ApprovalsService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "approvals.<method> not implemented (P3)")`. */
export function createNotImplementedApprovalsService(): ApprovalsService {
  return createNotImplemented<ApprovalsService>("approvals", "P3", {
    registerApplyHandler: "sync",
    registerRejectHandler: "sync",
    getApplyHandler: "sync",
    getRejectHandler: "sync",
    request: "async",
    decide: "async",
    execute: "async",
    listApprovals: "async",
    getApproval: "async",
    approveRequest: "async",
    rejectRequest: "async",
    cancelRequest: "async",
    retryApply: "async",
    approverSet: "async",
  });
}
