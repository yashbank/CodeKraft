/**
 * `approvals` service (PHASE-03 P3.2) — the generic dual-approval engine (MASTER_SPEC §4.5, §7
 * "Approver set"; docs/06 §2.7 API-ADM-01..04, §1.5 idempotency; BR-13, A-1101, D-1102).
 *
 * The frozen `ApprovalsService` contract (`./contracts.ts`) is implemented exactly. The engine only
 * orchestrates: it stores requests and decisions, computes the approver set at decision time, and
 * dispatches the owning module's apply / reject handler inside the same transaction as the final
 * decision. Handlers are registered by their modules (`register<Module>ApprovalHandlers`).
 *
 * Failure semantics (docs/06 API-ADM-02): a handler error (or a missing handler) is stored on
 * `approval_requests.error` inside a savepoint so the final decision itself is kept; the request
 * stays `approved` and `retryApply` (super_admin) re-runs `execute()`.
 */
import { and, asc, desc, eq, exists, not, sql } from "drizzle-orm";
import { IdempotentReplay } from "@/lib/actions/envelope";
import { assertRole } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { type DbOrTx, type TxCtx, type TxRunner, db as defaultDb, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { moduleLogger } from "@/lib/logger";
import type { ListResult } from "@/modules/_shared/zod";
import {
  type ApprovalDecision as ApprovalDecisionRow,
  type ApprovalRequest,
  approvalDecisions,
  approvalRequests,
} from "../../../drizzle/schema/approvals";
import { MIN_ACTIVE_ADMINS, loadAdminClassUserIds, loadApproverSet } from "./approver-set";
import type { ApplyContext, ApprovalsService } from "./contracts";
import { decodeCursor, paginate } from "./cursor";
import {
  type AuditPort,
  type NotificationsPort,
  lazyAuditService,
  lazyNotificationsService,
} from "./default-deps";
import { isTriggerError, isUniqueViolation } from "./pg-errors";
import { type HandlerRegistry, createApplyHandlerRegistry, missingHandlerMessage } from "./registry";
import {
  type ApprovalDecisionKind,
  type ApprovalPayload,
  type ApprovalStatus,
  type ApprovalSubject,
  type ApprovalType,
  type ApprovalView,
  type ApproveRequestInput,
  type CancelRequestInput,
  type DecideResult,
  type GetApprovalInput,
  type ListApprovalsInput,
  type RejectRequestInput,
  type RetryApplyInput,
  approvalPayloadSchemas,
  parseApprovalPayload,
} from "./types";

export interface ApprovalsDeps {
  audit: AuditPort;
  notifications: NotificationsPort;
  /** Handler registry (default: a fresh one — the process-wide instance lives on `approvalsService`). */
  registry?: HandlerRegistry;
  /** Read handle for the queries (`listApprovals` / `getApproval`); default the pooled client. */
  db?: DbOrTx;
  /** Opens transactions for the ctx-level methods when no `tx` is passed; default the pooled client. */
  txRunner?: TxRunner;
  /** Approver set resolver (MASTER_SPEC §7); default reads `users` × `user_roles`. */
  approverSet?: (requesterId: string, tx: DbOrTx) => Promise<string[]>;
  /** Active admin-class user ids (for the "fewer than two admins" guard). */
  adminClassUserIds?: (tx: DbOrTx) => Promise<string[]>;
  now?: () => Date;
}

const log = moduleLogger("approvals");
const ERROR_MAX = 1_000;

function errorText(err: unknown): string {
  const text =
    err instanceof AppError
      ? `${err.code}: ${err.message}`
      : err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err);
  return text.length > ERROR_MAX ? `${text.slice(0, ERROR_MAX - 1)}…` : text;
}

function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 3_600_000));
}

/** Human summary for API-ADM-01 lists (never includes secrets; payloads are ids and amounts). */
export function summarisePayload(type: ApprovalType, payload: ApprovalPayload): string {
  const p = payload as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : undefined);
  switch (type) {
    case "product.publish":
      return str("publishAt") !== undefined
        ? `Publish product ${str("productId")} at ${str("publishAt")}`
        : `Publish product ${str("productId")}`;
    case "product.archive":
      return `Archive product ${str("productId")}: ${str("reason") ?? ""}`.trim();
    case "product.delete":
      return `Delete product ${str("productId")}: ${str("reason") ?? ""}`.trim();
    case "ownership.change":
      return `Ownership change ${str("ownershipId")}`;
    case "admin.user_change": {
      const kind = str("kind");
      if (kind === "invite") return `Invite ${str("email")} as ${str("role")}`;
      if (kind === "change_role") return `Change role of user ${str("userId")} to ${str("role")}`;
      return `Remove admin user ${str("userId")}`;
    }
    case "refund.issue":
    case "ledger.adjustment":
    case "payout.record":
    case "project_order.split": {
      const amount = num("amountMinor");
      const currency = str("currency");
      const money =
        amount !== undefined && currency !== undefined ? ` ${String(amount)} ${currency} (minor)` : "";
      return `${type}${money}`;
    }
  }
}

export function createApprovalsService(deps: ApprovalsDeps): ApprovalsService & {
  readonly registry: HandlerRegistry;
} {
  const registry = deps.registry ?? createApplyHandlerRegistry();
  const approverSet = deps.approverSet ?? loadApproverSet;
  const adminIds = deps.adminClassUserIds ?? loadAdminClassUserIds;
  const now = deps.now ?? (() => new Date());
  const readDb = (): DbOrTx => deps.db ?? defaultDb;
  const run = <T>(fn: (tx: TxCtx) => Promise<T>, tx?: TxCtx) => withTx(fn, tx, deps.txRunner);

  async function lockRequest(requestId: string, tx: TxCtx): Promise<ApprovalRequest> {
    const [row] = await tx
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, requestId))
      .for("update");
    if (row === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Approval request not found.");
    return row;
  }

  async function loadDecisions(requestId: string, db: DbOrTx): Promise<ApprovalDecisionRow[]> {
    return db
      .select()
      .from(approvalDecisions)
      .where(eq(approvalDecisions.requestId, requestId))
      .orderBy(asc(approvalDecisions.createdAt), asc(approvalDecisions.id));
  }

  async function storeError(requestId: string, message: string, tx: TxCtx): Promise<void> {
    await tx
      .update(approvalRequests)
      .set({ error: message })
      .where(eq(approvalRequests.id, requestId));
  }

  async function notify(
    target: string | string[],
    type: "approval.requested" | "approval.approved" | "approval.rejected",
    payload: Record<string, unknown>,
    tx: TxCtx,
  ): Promise<void> {
    if (Array.isArray(target) && target.length === 0) return;
    try {
      await deps.notifications.emit(target, type, payload, undefined, tx);
    } catch (err) {
      // Notifications are best-effort (contract: never fail the domain transaction).
      log.warn({ err, type }, "approval notification failed");
    }
  }

  function subjectOf(row: ApprovalRequest): ApprovalSubject {
    return { type: row.subjectType, id: row.subjectId };
  }

  function toView(
    row: ApprovalRequest,
    decisions: readonly ApprovalDecisionRow[],
    approvers: readonly string[],
    at: Date,
  ): ApprovalView {
    const decided = new Set(decisions.map((d) => d.decidedBy));
    const payload = approvalPayloadSchemas[row.type].safeParse(row.payload);
    const parsedPayload = (payload.success ? payload.data : row.payload) as ApprovalPayload;
    return {
      id: row.id,
      type: row.type,
      subject: subjectOf(row),
      payloadSummary: summarisePayload(row.type, parsedPayload),
      payload: parsedPayload,
      requestedBy: row.requestedBy,
      status: row.status,
      decisions: decisions.map((d) => ({
        decidedBy: d.decidedBy,
        decision: d.decision,
        comment: d.comment,
        createdAt: d.createdAt.toISOString(),
      })),
      pendingApprovers: row.status === "pending" ? approvers.filter((id) => !decided.has(id)) : [],
      ageHours: hoursBetween(row.createdAt, at),
      error: row.error,
      appliedAt: row.appliedAt === null ? null : row.appliedAt.toISOString(),
    };
  }

  const service: ApprovalsService & { readonly registry: HandlerRegistry } = {
    registry,
    registerApplyHandler: (type, handler) => registry.registerApplyHandler(type, handler),
    registerRejectHandler: (type, handler) => registry.registerRejectHandler(type, handler),
    getApplyHandler: (type) => registry.getApplyHandler(type),
    getRejectHandler: (type) => registry.getRejectHandler(type),

    approverSet: (requesterId, tx) => approverSet(requesterId, tx),

    async request(type, subject, payload, requesterId, tx) {
      const parsed = approvalPayloadSchemas[type].safeParse(payload);
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION, `Invalid ${type} payload.`, {
          fieldErrors: Object.fromEntries(
            parsed.error.issues.map((i) => [i.path.map(String).join(".") || "_form", [i.message]]),
          ),
        });
      }
      const [row] = await tx
        .insert(approvalRequests)
        .values({
          type,
          subjectType: subject.type,
          subjectId: subject.id,
          payload: parsed.data as Record<string, unknown>,
          requestedBy: requesterId,
          status: "pending",
        })
        .returning({ id: approvalRequests.id });
      if (row === undefined) throw new AppError(ErrorCode.INTERNAL, "approval insert returned no row");
      const approvers = await approverSet(requesterId, tx);
      if (approvers.length === 0) {
        log.warn({ type, requesterId }, "approval requested with no eligible approver (FR-ADM-12)");
      }
      await notify(
        approvers,
        "approval.requested",
        { approvalRequestId: row.id, type, subjectType: subject.type, subjectId: subject.id, requestedBy: requesterId },
        tx,
      );
      return { approvalRequestId: row.id };
    },

    async decide(requestId, adminId, decision, comment, tx) {
      const row = await lockRequest(requestId, tx);
      if (row.requestedBy === adminId) {
        throw new AppError(ErrorCode.FORBIDDEN, "You cannot decide on your own request.");
      }
      const existing = await loadDecisions(requestId, tx);
      if (existing.some((d) => d.decidedBy === adminId)) {
        throw new IdempotentReplay<DecideResult>({
          status: row.status,
          applied: row.status === "applied",
        });
      }
      if (row.status !== "pending") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Approval request is ${row.status}; only pending requests can be decided.`,
        );
      }
      const approvers = await approverSet(row.requestedBy, tx);
      if (!approvers.includes(adminId)) {
        throw new AppError(ErrorCode.FORBIDDEN, "Only active admin-class users can decide.");
      }
      try {
        await tx.insert(approvalDecisions).values({
          requestId,
          decidedBy: adminId,
          decision,
          comment: comment ?? null,
        });
      } catch (err) {
        if (isTriggerError(err, "approver_is_requester")) {
          throw new AppError(ErrorCode.FORBIDDEN, "You cannot decide on your own request.", {
            cause: err,
          });
        }
        if (isUniqueViolation(err)) {
          throw new IdempotentReplay<DecideResult>({ status: row.status, applied: false });
        }
        throw err;
      }

      if (decision === "reject") {
        await tx
          .update(approvalRequests)
          .set({ status: "rejected" })
          .where(eq(approvalRequests.id, requestId));
        await runRejectHandler(row, adminId, tx);
        await notify(
          row.requestedBy,
          "approval.rejected",
          { approvalRequestId: requestId, type: row.type, decidedBy: adminId, comment: comment ?? null },
          tx,
        );
        return { status: "rejected", applied: false };
      }

      const approvedBy = new Set(
        existing.filter((d) => d.decision === "approve").map((d) => d.decidedBy),
      );
      approvedBy.add(adminId);
      const complete = approvers.every((id) => approvedBy.has(id));
      if (!complete) return { status: "pending", applied: false };

      await tx
        .update(approvalRequests)
        .set({ status: "approved" })
        .where(eq(approvalRequests.id, requestId));
      const result = await service.execute(requestId, tx);
      await notify(
        row.requestedBy,
        "approval.approved",
        { approvalRequestId: requestId, type: row.type, decidedBy: adminId, applied: result.applied },
        tx,
      );
      return result;
    },

    async execute(requestId, tx) {
      const row = await lockRequest(requestId, tx);
      if (row.status === "applied") {
        throw new IdempotentReplay<DecideResult>({ status: "applied", applied: true });
      }
      if (row.status !== "approved") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Approval request is ${row.status}; only approved requests can be executed.`,
        );
      }
      const admins = await adminIds(tx);
      if (admins.length < MIN_ACTIVE_ADMINS) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Dual approval needs at least two active admin-class users.",
        );
      }
      const decisions = await loadDecisions(requestId, tx);
      const lastApprove = [...decisions].reverse().find((d) => d.decision === "approve");
      const ctx: ApplyContext = {
        requestId,
        type: row.type,
        subject: subjectOf(row),
        requestedBy: row.requestedBy,
        decidedBy: lastApprove?.decidedBy ?? row.requestedBy,
      };
      const handler = registry.getApplyHandler(row.type);
      if (handler === undefined) {
        const message = missingHandlerMessage(row.type);
        log.error({ requestId, type: row.type }, message);
        await storeError(requestId, message, tx);
        return { status: "approved", applied: false };
      }
      let payload: ApprovalPayload;
      try {
        payload = parseApprovalPayload(row.type, row.payload);
      } catch (err) {
        await storeError(requestId, errorText(err), tx);
        return { status: "approved", applied: false };
      }
      try {
        // Savepoint: a failing handler must not poison the outer transaction (the decision stays).
        await tx.transaction((sp) => handler(ctx, payload as never, sp));
      } catch (err) {
        log.error({ err, requestId, type: row.type }, "approval apply handler failed");
        await storeError(requestId, errorText(err), tx);
        return { status: "approved", applied: false };
      }
      await tx
        .update(approvalRequests)
        .set({ status: "applied", appliedAt: now(), error: null })
        .where(eq(approvalRequests.id, requestId));
      return { status: "applied", applied: true };
    },

    async listApprovals(ctx, input): Promise<ListResult<ApprovalView>> {
      const db = readDb();
      const f = input.filters ?? {};
      const cursor = decodeCursor(input.cursor);
      const direction = input.sort === "createdAt:asc" ? "asc" : "desc";
      const conditions = [
        f.status !== undefined ? eq(approvalRequests.status, f.status) : undefined,
        f.type !== undefined ? eq(approvalRequests.type, f.type) : undefined,
        f.requestedBy !== undefined ? eq(approvalRequests.requestedBy, f.requestedBy) : undefined,
        f.mine === true
          ? and(
              eq(approvalRequests.status, "pending"),
              not(eq(approvalRequests.requestedBy, ctx.userId)),
              not(
                exists(
                  db
                    .select({ one: sql`1` })
                    .from(approvalDecisions)
                    .where(
                      and(
                        eq(approvalDecisions.requestId, approvalRequests.id),
                        eq(approvalDecisions.decidedBy, ctx.userId),
                      ),
                    ),
                ),
              ),
            )
          : undefined,
        input.q !== undefined && input.q !== ""
          ? sql`(${approvalRequests.subjectId}::text ILIKE ${`%${input.q}%`} OR ${approvalRequests.payload}::text ILIKE ${`%${input.q}%`})`
          : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const keyset =
        cursor === undefined
          ? undefined
          : direction === "desc"
            ? sql`(${approvalRequests.createdAt}, ${approvalRequests.id}) < (${String(cursor.v)}::timestamptz, ${cursor.id}::uuid)`
            : sql`(${approvalRequests.createdAt}, ${approvalRequests.id}) > (${String(cursor.v)}::timestamptz, ${cursor.id}::uuid)`;
      const order = direction === "desc" ? desc : asc;
      const rows = await db
        .select()
        .from(approvalRequests)
        .where(keyset === undefined ? where : and(where, keyset))
        .orderBy(order(approvalRequests.createdAt), order(approvalRequests.id))
        .limit(input.limit + 1);
      const [{ count } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(approvalRequests)
        .where(where);
      const page = paginate(rows, input.limit, (r) => ({ v: r.createdAt.toISOString(), id: r.id }));
      const admins = await adminIds(db);
      const at = now();
      const items: ApprovalView[] = [];
      for (const row of page.items) {
        const decisions = await loadDecisions(row.id, db);
        items.push(toView(row, decisions, admins.filter((id) => id !== row.requestedBy), at));
      }
      return { items, nextCursor: page.nextCursor, total: count };
    },

    async getApproval(_ctx, input: GetApprovalInput) {
      const db = readDb();
      const [row] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, input.approvalRequestId))
        .limit(1);
      if (row === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Approval request not found.");
      const [decisions, approvers] = await Promise.all([
        loadDecisions(row.id, db),
        approverSet(row.requestedBy, db),
      ]);
      return toView(row, decisions, approvers, now());
    },

    approveRequest(ctx, input: ApproveRequestInput, tx) {
      return run(async (t) => {
        const before = await lockRequest(input.approvalRequestId, t);
        const result = await service.decide(
          input.approvalRequestId,
          ctx.userId,
          "approve",
          input.comment,
          t,
        );
        await deps.audit.log(
          ctx,
          "API-ADM-02 approval.approve",
          { type: "approval_request", id: input.approvalRequestId },
          { status: before.status },
          { status: result.status, applied: result.applied, comment: input.comment ?? null },
          t,
        );
        return result;
      }, tx);
    },

    rejectRequest(ctx, input: RejectRequestInput, tx) {
      return run(async (t) => {
        const before = await lockRequest(input.approvalRequestId, t);
        const result = await service.decide(
          input.approvalRequestId,
          ctx.userId,
          "reject",
          input.comment,
          t,
        );
        await deps.audit.log(
          ctx,
          "API-ADM-03 approval.reject",
          { type: "approval_request", id: input.approvalRequestId },
          { status: before.status },
          { status: result.status, comment: input.comment },
          t,
        );
        return result;
      }, tx);
    },

    cancelRequest(ctx, input: CancelRequestInput, tx) {
      return run(async (t) => {
        const row = await lockRequest(input.approvalRequestId, t);
        if (row.requestedBy !== ctx.userId) {
          throw new AppError(ErrorCode.FORBIDDEN, "Only the requester can cancel a request.");
        }
        if (row.status !== "pending") {
          throw new AppError(
            ErrorCode.STATE_INVALID,
            `Approval request is ${row.status}; only pending requests can be cancelled.`,
          );
        }
        await t
          .update(approvalRequests)
          .set({ status: "cancelled" })
          .where(eq(approvalRequests.id, row.id));
        // Compensate like a rejection so the subject does not stay half-submitted (e.g. a product in
        // `pending_approval`, a `refunds` row) — the reject handler is the type's undo.
        await runRejectHandler(row, ctx.userId, t);
        await deps.audit.log(
          ctx,
          "API-ADM-04 approval.cancel",
          { type: "approval_request", id: row.id },
          { status: row.status },
          { status: "cancelled" },
          t,
        );
        return { status: "cancelled", applied: false };
      }, tx);
    },

    retryApply(ctx, input: RetryApplyInput, tx) {
      assertRole(ctx, "super_admin");
      return run(async (t) => {
        const row = await lockRequest(input.approvalRequestId, t);
        if (row.status !== "approved" || row.error === null) {
          throw new AppError(
            ErrorCode.STATE_INVALID,
            "Only approved requests whose apply failed can be retried.",
          );
        }
        const result = await service.execute(row.id, t);
        await deps.audit.log(
          ctx,
          "API-ADM-04 approval.retry",
          { type: "approval_request", id: row.id },
          { status: row.status, error: row.error },
          { status: result.status, applied: result.applied },
          t,
        );
        return result;
      }, tx);
    },
  };

  async function runRejectHandler(row: ApprovalRequest, decidedBy: string, tx: TxCtx) {
    const handler = registry.getRejectHandler(row.type);
    if (handler === undefined) return;
    const payload = parseApprovalPayload(row.type, row.payload);
    const ctx: ApplyContext = {
      requestId: row.id,
      type: row.type,
      subject: subjectOf(row),
      requestedBy: row.requestedBy,
      decidedBy,
    };
    await handler(ctx, payload as never, tx);
  }

  return service;
}

export const defaultApprovalsDeps: ApprovalsDeps = {
  audit: lazyAuditService(),
  notifications: lazyNotificationsService(),
};

/** Process-wide instance; modules register their handlers on `approvalsService.registry`. */
export const approvalsService = createApprovalsService(defaultApprovalsDeps);

export type { ApprovalDecisionKind, ApprovalStatus, ApprovalType, DecideResult, ListApprovalsInput };
