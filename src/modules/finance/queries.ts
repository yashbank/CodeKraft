"use server";

/**
 * `finance` read-only queries (API-FIN-01 listLedgerEntries, API-FIN-02 getOrderAllocation,
 * API-FIN-03 getPartnerBalances, API-FIN-09 getReport, API-FIN-11 listPayouts/listExpenses,
 * PHASE-04/PHASE-05). Queries are `defineAction` reads that never mutate; the underlying service
 * methods already assert the relevant `finance.*` permission.
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  getOrderAllocationInput,
  getPartnerBalancesInput,
  getReportInput,
  listExpensesInput,
  listLedgerEntriesInput,
  listPayoutsInput,
} from "./types";
import { financeService } from "./service";

export const listLedgerEntriesQuery = defineAction({
  name: "API-FIN-01 listLedgerEntries",
  permission: "finance.ledger.read",
  input: listLedgerEntriesInput,
  handler: (input, ctx) => financeService.listLedgerEntries(ctx, input),
});

export const getOrderAllocationQuery = defineAction({
  name: "API-FIN-02 getOrderAllocation",
  permission: "finance.ledger.read",
  input: getOrderAllocationInput,
  handler: (input, ctx) => financeService.getOrderAllocation(ctx, input),
});

export const getPartnerBalancesQuery = defineAction({
  name: "API-FIN-03 getPartnerBalances",
  permission: "finance.ledger.read",
  input: getPartnerBalancesInput,
  handler: (input, ctx) => financeService.getPartnerBalances(ctx, input),
});

export const getReportQuery = defineAction({
  name: "API-FIN-09 getReport",
  permission: "finance.reports.read",
  input: getReportInput,
  handler: (input, ctx) => financeService.getReport(ctx, input),
});

export const listPayoutsQuery = defineAction({
  name: "API-FIN-11 listPayouts",
  permission: "finance.ledger.read",
  input: listPayoutsInput,
  handler: (input, ctx) => financeService.listPayouts(ctx, input),
});

export const listExpensesQuery = defineAction({
  name: "API-FIN-11 listExpenses",
  permission: "finance.ledger.read",
  input: listExpensesInput,
  handler: (input, ctx) => financeService.listExpenses(ctx, input),
});
