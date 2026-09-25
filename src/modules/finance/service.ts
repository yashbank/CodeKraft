/**
 * `finance` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P4; the signatures are
 * the frozen `FinanceService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { FinanceService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "finance.<method> not implemented (P4)")`. */
export function createNotImplementedFinanceService(): FinanceService {
  return createNotImplemented<FinanceService>("finance", "P4", {
    postOrderPaid: "async",
    postRefund: "async",
    postPayout: "async",
    postExpense: "async",
    postAdjustment: "async",
    computeAllocation: "sync",
    spreadDeduction: "sync",
    listLedgerEntries: "async",
    getOrderAllocation: "async",
    getPartnerBalances: "async",
    getReport: "async",
    listPayouts: "async",
    listExpenses: "async",
    recordPayout: "async",
    applyPayout: "async",
    recordExpense: "async",
    proposeAdjustment: "async",
    applyAdjustment: "async",
    exportStatement: "async",
  });
}
