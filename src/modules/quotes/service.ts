/**
 * `quotes` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P4; the signatures are
 * the frozen `QuotesService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { QuotesService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "quotes.<method> not implemented (P4)")`. */
export function createNotImplementedQuotesService(): QuotesService {
  return createNotImplemented<QuotesService>("quotes", "P4", {
    createCustomQuote: "async",
    sendCustomQuote: "async",
    cancelCustomQuote: "async",
    listQuotes: "async",
    getQuote: "async",
    acceptCustomQuote: "async",
    markPaid: "async",
    expireQuotes: "async",
  });
}
