"use server";

/**
 * `finance` read-only queries (API-FIN-01 listLedgerEntries, API-FIN-02 getOrderAllocation,
 * PHASE-04). Queries are `defineAction` reads that never mutate; the underlying service methods
 * already assert `finance.ledger.read`.
 */
import { defineAction } from "@/lib/actions/envelope";
import { getOrderAllocationInput, listLedgerEntriesInput } from "./types";
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
