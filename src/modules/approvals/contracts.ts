/**
 * Approvals service contract (docs/06 §2.7 API-ADM-01..04; docs/04 §7.4; master plan §5).
 *
 * Frozen (master plan §5): `request(type, subject, payload, requesterId, tx)`,
 * `decide(requestId, adminId, decision, comment?, tx)`, `execute(requestId, tx)`,
 * `registerApplyHandler(type, handler)`, `registerRejectHandler(type, handler)`.
 * The approvals module only orchestrates and audits; applying is the owning module's handler,
 * dispatched by `execute()` in the same transaction as the final decision. Application is
 * idempotent per `approvalRequestId` (docs/06 §1.5).
 */
import type { TxCtx } from "@/lib/db";
import type { RequestContext } from "@/lib/authz/context";
import type { ListResult } from "@/modules/orders/types";
import type {
  ApprovalDecisionKind,
  ApprovalPayloadMap,
  ApprovalSubject,
  ApprovalType,
  ApprovalView,
  ApproveRequestInput,
  CancelRequestInput,
  DecideResult,
  GetApprovalInput,
  ListApprovalsInput,
  RejectRequestInput,
  RetryApplyInput,
} from "./types";

export interface ApplyContext {
  requestId: string;
  type: ApprovalType;
  subject: ApprovalSubject;
  requestedBy: string;
  /** The admin whose approval completed the set (actor for audit rows of the apply). */
  decidedBy: string;
}

/** Module-owned `apply<Type>` handler (docs/06 rows marked "internal"). Throw to leave the request `approved` with `error`. */
export type ApplyHandler<TPayload> = (
  ctx: ApplyContext,
  payload: TPayload,
  tx: TxCtx,
) => Promise<void>;

/** Module-owned `onRejected` compensation (API-ADM-03): publish → draft, ownership → pending version deleted, refund → row deleted. */
export type RejectHandler<TPayload> = (
  ctx: ApplyContext,
  payload: TPayload,
  tx: TxCtx,
) => Promise<void>;

/** Registry keyed by type; one handler per type, registered at module bootstrap. */
export interface ApplyHandlerRegistry {
  registerApplyHandler<T extends ApprovalType>(
    type: T,
    handler: ApplyHandler<ApprovalPayloadMap[T]>,
  ): void;
  registerRejectHandler<T extends ApprovalType>(
    type: T,
    handler: RejectHandler<ApprovalPayloadMap[T]>,
  ): void;
  getApplyHandler<T extends ApprovalType>(type: T): ApplyHandler<ApprovalPayloadMap[T]> | undefined;
  getRejectHandler<T extends ApprovalType>(
    type: T,
  ): RejectHandler<ApprovalPayloadMap[T]> | undefined;
}

export interface ApprovalsService extends ApplyHandlerRegistry {
  /**
   * Create a `pending` request (`N: approval.requested` to every other admin-class user).
   * Payload is validated against `approvalPayloadSchemas[type]`.
   */
  request<T extends ApprovalType>(
    type: T,
    subject: ApprovalSubject,
    payload: ApprovalPayloadMap[T],
    requesterId: string,
    tx: TxCtx,
  ): Promise<{ approvalRequestId: string }>;

  /**
   * Record a decision (trigger `approver_is_requester` → `FORBIDDEN`; `STATE_INVALID` unless
   * pending; second approval by the same admin → `IDEMPOTENT_REPLAY`). When every current
   * admin-class user other than the requester has approved → `approved` → `execute()`.
   * A `reject` sets `rejected` and runs the type's reject handler.
   */
  decide(
    requestId: string,
    adminId: string,
    decision: ApprovalDecisionKind,
    comment: string | undefined,
    tx: TxCtx,
  ): Promise<DecideResult>;

  /**
   * Dispatch the apply handler for an `approved` request: `applied`/`applied_at` on success;
   * on failure `error` is stored and status stays `approved` (retry via API-ADM-04).
   */
  execute(requestId: string, tx: TxCtx): Promise<DecideResult>;

  /** API-ADM-01 `listApprovals` (query) — `approvals.read`. */
  listApprovals(ctx: RequestContext, input: ListApprovalsInput): Promise<ListResult<ApprovalView>>;
  /** API-ADM-01 `getApproval` (query). */
  getApproval(ctx: RequestContext, input: GetApprovalInput): Promise<ApprovalView>;
  /** API-ADM-02 `approveRequest` — `approvals.decide` (`never_own_requests`). */
  approveRequest(
    ctx: RequestContext,
    input: ApproveRequestInput,
    tx?: TxCtx,
  ): Promise<DecideResult>;
  /** API-ADM-03 `rejectRequest` — comment required. */
  rejectRequest(ctx: RequestContext, input: RejectRequestInput, tx?: TxCtx): Promise<DecideResult>;
  /** API-ADM-04 `cancelRequest` — requester only, while `pending`. */
  cancelRequest(ctx: RequestContext, input: CancelRequestInput, tx?: TxCtx): Promise<DecideResult>;
  /** API-ADM-04 `retryApply` — `super_admin`, re-runs `execute()` for `approved` with `error`. */
  retryApply(ctx: RequestContext, input: RetryApplyInput, tx?: TxCtx): Promise<DecideResult>;

  /** Approver set = active `super_admin`/`admin` users except the requester (MASTER_SPEC §7). */
  approverSet(requesterId: string, tx: TxCtx): Promise<string[]>;
}

/** Master plan §5 method names, for the P2.8 freeze / fixture test. */
export const APPROVALS_CONTRACT_METHODS = [
  "request",
  "decide",
  "execute",
  "registerApplyHandler",
  "registerRejectHandler",
] as const satisfies readonly (keyof ApprovalsService)[];
