/**
 * `settings` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `SettingsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { SettingsService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "settings.<method> not implemented (P3)")`. */
export function createNotImplementedSettingsService(): SettingsService {
  return createNotImplemented<SettingsService>("settings", "P3", {
    getSettings: "async",
    updateSettings: "async",
    getPublicSettings: "async",
    setVisitorPreferences: "async",
    load: "async",
    loadFlag: "async",
  });
}
