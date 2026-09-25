/**
 * `subscriptions` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P5; the signatures are
 * the frozen `SubscriptionsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { SubscriptionsService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "subscriptions.<method> not implemented (P5)")`. */
export function createNotImplementedSubscriptionsService(): SubscriptionsService {
  return createNotImplemented<SubscriptionsService>("subscriptions", "P5", {
    renew: "async",
    onRenewalPaid: "async",
    cancelAtPeriodEnd: "async",
    cancelAdmin: "async",
    runRemindGraceSuspendJob: "async",
  });
}
