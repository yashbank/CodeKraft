/**
 * `analytics` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P6; the signatures are
 * the frozen `AnalyticsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { AnalyticsService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "analytics.<method> not implemented (P6)")`. */
export function createNotImplementedAnalyticsService(): AnalyticsService {
  return createNotImplemented<AnalyticsService>("analytics", "P6", {
    trackEvent: "async",
    trackWebVital: "async",
    recordServerEvent: "async",
    listJobRuns: "async",
    getSystemHealthWidget: "async",
    runVitalsRollupJob: "async",
  });
}
