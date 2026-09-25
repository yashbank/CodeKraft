/**
 * `coupons` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P4; the signatures are
 * the frozen `CouponsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { CouponsService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "coupons.<method> not implemented (P4)")`. */
export function createNotImplementedCouponsService(): CouponsService {
  return createNotImplemented<CouponsService>("coupons", "P4", {
    upsertCoupon: "async",
    deactivateCoupon: "async",
    listCoupons: "async",
    validateForOrder: "async",
    redeemForOrder: "async",
  });
}
