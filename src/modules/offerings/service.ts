/**
 * `offerings` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `OfferingsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { OfferingsService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "offerings.<method> not implemented (P3)")`. */
export function createNotImplementedOfferingsService(): OfferingsService {
  return createNotImplemented<OfferingsService>("offerings", "P3", {
    upsertOffering: "async",
    deleteOffering: "async",
    setOfferingPrices: "async",
    setOfferingPaymentMethods: "async",
    listForProduct: "async",
    isPublishReady: "async",
  });
}
