/**
 * Approvals handler registry (docs/06 §2.7, PHASE-03 P3.2).
 * Stores module-owned apply and reject handlers for the 9 approval types.
 */
import type { ApplyHandler, ApplyHandlerRegistry, RejectHandler } from "./contracts";
import type { ApprovalPayload, ApprovalPayloadMap, ApprovalType } from "./types";

export class InMemoryApplyHandlerRegistry implements ApplyHandlerRegistry {
  private readonly applyHandlers = new Map<ApprovalType, ApplyHandler<ApprovalPayload>>();

  private readonly rejectHandlers = new Map<ApprovalType, RejectHandler<ApprovalPayload>>();

  registerApplyHandler<T extends ApprovalType>(
    type: T,
    handler: ApplyHandler<ApprovalPayloadMap[T]>,
  ): void {
    this.applyHandlers.set(type, handler as unknown as ApplyHandler<ApprovalPayload>);
  }

  registerRejectHandler<T extends ApprovalType>(
    type: T,
    handler: RejectHandler<ApprovalPayloadMap[T]>,
  ): void {
    this.rejectHandlers.set(type, handler as unknown as RejectHandler<ApprovalPayload>);
  }

  getApplyHandler<T extends ApprovalType>(
    type: T,
  ): ApplyHandler<ApprovalPayloadMap[T]> | undefined {
    return this.applyHandlers.get(type) as unknown as
      ApplyHandler<ApprovalPayloadMap[T]> | undefined;
  }

  getRejectHandler<T extends ApprovalType>(
    type: T,
  ): RejectHandler<ApprovalPayloadMap[T]> | undefined {
    return this.rejectHandlers.get(type) as unknown as
      RejectHandler<ApprovalPayloadMap[T]> | undefined;
  }

  clear(): void {
    this.applyHandlers.clear();
    this.rejectHandlers.clear();
  }
}

export const defaultHandlerRegistry = new InMemoryApplyHandlerRegistry();
