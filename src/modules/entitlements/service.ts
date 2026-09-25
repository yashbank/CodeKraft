/**
 * `entitlements` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P5; the signatures are
 * the frozen `EntitlementsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { EntitlementsService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "entitlements.<method> not implemented (P5)")`. */
export function createNotImplementedEntitlementsService(): EntitlementsService {
  return createNotImplemented<EntitlementsService>("entitlements", "P5", {
    grantForOrder: "async",
    grantManual: "async",
    revoke: "async",
    revokeEntitlement: "async",
    listMyEntitlements: "async",
    getMyEntitlement: "async",
    issueDownloadLink: "async",
    revealLicenseKey: "async",
    listEntitlementsAdmin: "async",
    getEntitlementAdmin: "async",
    resetDownloadCount: "async",
    extendAccess: "async",
    runExpireJob: "async",
  });
}
