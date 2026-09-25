/**
 * `ownership` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `OwnershipService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { OwnershipService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "ownership.<method> not implemented (P3)")`. */
export function createNotImplementedOwnershipService(): OwnershipService {
  return createNotImplemented<OwnershipService>("ownership", "P3", {
    proposeOwnership: "async",
    applyOwnershipChange: "async",
    onOwnershipChangeRejected: "async",
    createInitial: "async",
    activateForPublish: "async",
    getActiveAt: "async",
    listVersions: "async",
    summaryFor: "async",
  });
}
