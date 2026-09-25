/**
 * `queries` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P6; the signatures are
 * the frozen `QueriesService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { QueriesService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "queries.<method> not implemented (P6)")`. */
export function createNotImplementedQueriesService(): QueriesService {
  return createNotImplemented<QueriesService>("queries", "P6", {
    createQuery: "async",
    createQueryAdmin: "async",
    createFromEscalation: "async",
    listMyQueries: "async",
    getMyQuery: "async",
    replyToQuery: "async",
    listQueriesAdmin: "async",
    getQueryAdmin: "async",
    assignQuery: "async",
    closeQuery: "async",
    reopenQuery: "async",
    runAutoCloseJob: "async",
  });
}
