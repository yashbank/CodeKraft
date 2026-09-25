/**
 * `search` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `SearchService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { SearchService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "search.<method> not implemented (P3)")`. */
export function createNotImplementedSearchService(): SearchService {
  return createNotImplemented<SearchService>("search", "P3", {
    listProducts: "async",
    listFilterFacets: "async",
    listPublishedSlugs: "async",
  });
}
