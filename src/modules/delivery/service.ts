/**
 * `delivery` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P5; the signatures are
 * the frozen `DeliveryService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { DeliveryService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "delivery.<method> not implemented (P5)")`. */
export function createNotImplementedDeliveryService(): DeliveryService {
  return createNotImplemented<DeliveryService>("delivery", "P5", {
    completeProvisioning: "async",
    setLicenseKey: "async",
    markServiceStep: "async",
    listDeliveryTasks: "async",
    completeDeliveryTask: "async",
    assignDeliveryTask: "async",
    evaluateOrderFulfilment: "async",
  });
}
