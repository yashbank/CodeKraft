/**
 * `payments` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P4; the signatures are
 * the frozen `PaymentsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { PaymentsService } from "./contracts";
import type { ProviderRegistry } from "./provider";

/** Every member throws / rejects `AppError(INTERNAL, "payments.<method> not implemented (P4)")`. */
export function createNotImplementedPaymentsService(): PaymentsService {
  return createNotImplemented<PaymentsService>("payments", "P4", {
    providers: {
      value: createNotImplemented<ProviderRegistry>("payments.providers", "P4", {
        get: "sync",
        has: "sync",
        register: "sync",
        enabledMethods: "sync",
      }),
    },
    getPaymentInstructions: "async",
    submitPaymentReference: "async",
    confirmPayment: "async",
    failPayment: "async",
    proposeRefund: "async",
    applyRefund: "async",
    listPaymentsAwaiting: "async",
    flagChargeback: "async",
    createIntentForOrder: "async",
  });
}
