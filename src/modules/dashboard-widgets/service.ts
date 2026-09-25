/**
 * `dashboard-widgets` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P8; the signatures are
 * the frozen `DashboardWidgetsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { DashboardWidgetsService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "dashboard-widgets.<method> not implemented (P8)")`. */
export function createNotImplementedDashboardWidgetsService(): DashboardWidgetsService {
  return createNotImplemented<DashboardWidgetsService>("dashboard-widgets", "P8", {
    getDashboardLayout: "async",
    saveDashboardLayout: "async",
    loadWidgetData: "async",
  });
}
