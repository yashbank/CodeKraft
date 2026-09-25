/**
 * `fx` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `FxService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { FxService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "fx.<method> not implemented (P3)")`. */
export function createNotImplementedFxService(): FxService {
  return createNotImplemented<FxService>("fx", "P3", {
    refreshFxRates: "async",
    setFxOverride: "async",
    listRates: "async",
    getRate: "async",
  });
}
