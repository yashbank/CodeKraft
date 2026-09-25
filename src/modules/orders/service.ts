/**
 * `orders` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P4; the signatures are
 * the frozen `OrdersService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { OrdersService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "orders.<method> not implemented (P4)")`. */
export function createNotImplementedOrdersService(): OrdersService {
  return createNotImplemented<OrdersService>("orders", "P4", {
    previewCheckout: "async",
    createOrder: "async",
    cancelMyOrder: "async",
    retryPayment: "async",
    listMyOrders: "async",
    getMyOrder: "async",
    listOrdersAdmin: "async",
    getOrderAdmin: "async",
    createManualOrder: "async",
    applyProjectOrderSplit: "async",
    markPaid: "async",
    evaluateFulfilled: "async",
    expirePendingOrders: "async",
  });
}
