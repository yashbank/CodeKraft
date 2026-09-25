/**
 * Apply / reject handler registry (docs/06 §2.7, master plan §5). One handler per approval type;
 * the owning module registers its handlers at bootstrap through `register<Module>ApprovalHandlers`
 * (approvals never registers handlers for other modules). Registration is idempotent — a second
 * registration for a type replaces the first (HMR-safe).
 */
import type { ApplyHandler, ApplyHandlerRegistry, RejectHandler } from "./contracts";
import { APPROVAL_TYPES, type ApprovalPayloadMap, type ApprovalType } from "./types";

type AnyApply = ApplyHandler<ApprovalPayloadMap[ApprovalType]>;
type AnyReject = RejectHandler<ApprovalPayloadMap[ApprovalType]>;

export interface HandlerRegistry extends ApplyHandlerRegistry {
  /** Types with no apply handler yet (P3.9 / P3.8 / P4 register theirs later). */
  missingApplyHandlers(): ApprovalType[];
  /** Forget every handler (tests). */
  reset(): void;
}

export function createApplyHandlerRegistry(): HandlerRegistry {
  const apply = new Map<ApprovalType, AnyApply>();
  const reject = new Map<ApprovalType, AnyReject>();
  return {
    registerApplyHandler(type, handler) {
      apply.set(type, handler as AnyApply);
    },
    registerRejectHandler(type, handler) {
      reject.set(type, handler as AnyReject);
    },
    getApplyHandler<T extends ApprovalType>(type: T) {
      return apply.get(type) as ApplyHandler<ApprovalPayloadMap[T]> | undefined;
    },
    getRejectHandler<T extends ApprovalType>(type: T) {
      return reject.get(type) as RejectHandler<ApprovalPayloadMap[T]> | undefined;
    },
    missingApplyHandlers() {
      return APPROVAL_TYPES.filter((t) => !apply.has(t));
    },
    reset() {
      apply.clear();
      reject.clear();
    },
  };
}

/** Message stored on `approval_requests.error` when `execute()` finds no handler. */
export function missingHandlerMessage(type: ApprovalType): string {
  return `No apply handler registered for approval type '${type}'. The owning module must call registerApplyHandler('${type}', …) at bootstrap; retry the request (API-ADM-04) once it does.`;
}
