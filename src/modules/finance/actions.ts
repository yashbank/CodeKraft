"use server";

/**
 * `finance` Server Actions (API-FIN-04 recordPayout, API-FIN-06 recordExpense,
 * API-FIN-07 proposeAdjustment, API-FIN-10 exportStatement — PHASE-05).
 * Every export is created with `defineAction` (`tests/static/actions-use-define-action.test.ts`,
 * SA-07). `applyPayout` / `applyAdjustment` are internal approval apply handlers, not
 * admin-triggerable actions, so they are intentionally not wrapped here.
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  exportStatementInput,
  proposeAdjustmentInput,
  recordExpenseInput,
  recordPayoutInput,
} from "./types";
import { financeService } from "./service";

export const recordPayoutAction = defineAction({
  name: "API-FIN-04 payout.record",
  permission: "finance.payout.record",
  input: recordPayoutInput,
  handler: async (input, ctx) => {
    return await financeService.recordPayout(ctx, input);
  },
});

export const recordExpenseAction = defineAction({
  name: "API-FIN-06 expense.record",
  permission: "finance.expense.write",
  input: recordExpenseInput,
  handler: async (input, ctx) => {
    return await financeService.recordExpense(ctx, input);
  },
});

export const proposeAdjustmentAction = defineAction({
  name: "API-FIN-07 ledger.adjustment.propose",
  permission: "finance.adjustment.propose",
  input: proposeAdjustmentInput,
  handler: async (input, ctx) => {
    return await financeService.proposeAdjustment(ctx, input);
  },
});

export const exportStatementAction = defineAction({
  name: "API-FIN-10 statement.export",
  permission: "finance.statements.export",
  input: exportStatementInput,
  handler: async (input, ctx) => {
    return await financeService.exportStatement(ctx, input);
  },
});
