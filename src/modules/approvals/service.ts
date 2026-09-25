/**
 * Approvals service implementation (docs/06 §2.7 API-ADM-01..04; MASTER_SPEC §4.5; PHASE-03 P3.2).
 *
 * Implements ApprovalsService with:
 * - Generic dual-admin approval lifecycle
 * - Dynamic approver set computation
 * - Self-approval prevention (service + trigger defence)
 * - Atomic apply execution and retry
 * - Idempotent decision replay
 * - Audit logging on all transitions
 */
import { and, desc, eq, ne, sql } from "drizzle-orm";
import {
  approvalDecisions,
  approvalRequests,
  type ApprovalType,
} from "../../../drizzle/schema/approvals";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { ListResult } from "@/modules/_shared/zod";
import { auditService } from "@/modules/audit/service";
import type { ApplyContext, ApplyHandler, ApprovalsService, RejectHandler } from "./contracts";
import {
  type ApprovalDecisionKind,
  type ApprovalPayload,
  type ApprovalPayloadMap,
  type ApprovalSubject,
  type ApprovalView,
  type ApproveRequestInput,
  type CancelRequestInput,
  type DecideResult,
  type GetApprovalInput,
  type ListApprovalsInput,
  type RejectRequestInput,
  type RetryApplyInput,
  approvalPayloadSchemas,
} from "./types";
import { defaultHandlerRegistry, InMemoryApplyHandlerRegistry } from "./registry";
import { computeApproverSet, countActiveAdmins } from "./approver-set";

/** Preserved for freeze and contract tests (PHASE-02 P2.8). */
export function createNotImplementedApprovalsService(): ApprovalsService {
  return createNotImplemented<ApprovalsService>("approvals", "P3", {
    registerApplyHandler: "sync",
    registerRejectHandler: "sync",
    getApplyHandler: "sync",
    getRejectHandler: "sync",
    request: "async",
    decide: "async",
    execute: "async",
    listApprovals: "async",
    getApproval: "async",
    approveRequest: "async",
    rejectRequest: "async",
    cancelRequest: "async",
    retryApply: "async",
    approverSet: "async",
  });
}

function payloadSummaryFor(type: ApprovalType, payload: Record<string, unknown>): string {
  switch (type) {
    case "product.publish":
      return `Publish product ${String(payload.productId ?? "")}`;
    case "ownership.change":
      return `Update ownership splits for product ${String(payload.productId ?? "")}`;
    case "ledger.adjustment":
      return `Ledger adjustment ${String(payload.reason ?? "")}`;
    case "refund.issue":
      return `Refund ${String(payload.amountMinor ?? "")} for payment ${String(payload.paymentId ?? "")}`;
    case "payout.record":
      return `Payout to partner ${String(payload.partnerId ?? "")}`;
    case "product.archive":
      return `Archive product ${String(payload.productId ?? "")}`;
    case "product.delete":
      return `Delete product ${String(payload.productId ?? "")}`;
    case "admin.user_change":
      return `Admin user change: ${String(payload.kind ?? "")}`;
    case "project_order.split":
      return `Split order ${String(payload.orderId ?? "")}`;
    default:
      return `${type} approval request`;
  }
}

export class DefaultApprovalsService implements ApprovalsService {
  constructor(
    private readonly registry: InMemoryApplyHandlerRegistry = defaultHandlerRegistry,
    private readonly getCustomDb?: () => DbOrTx,
  ) {}

  private async getDatabase(tx?: TxCtx): Promise<DbOrTx> {
    if (tx) return tx;
    if (this.getCustomDb) return this.getCustomDb();
    const { db } = await import("@/lib/db");
    return db;
  }

  registerApplyHandler<T extends ApprovalType>(
    type: T,
    handler: ApplyHandler<ApprovalPayloadMap[T]>,
  ): void {
    this.registry.registerApplyHandler(type, handler);
  }

  registerRejectHandler<T extends ApprovalType>(
    type: T,
    handler: RejectHandler<ApprovalPayloadMap[T]>,
  ): void {
    this.registry.registerRejectHandler(type, handler);
  }

  getApplyHandler<T extends ApprovalType>(
    type: T,
  ): ApplyHandler<ApprovalPayloadMap[T]> | undefined {
    return this.registry.getApplyHandler(type);
  }

  getRejectHandler<T extends ApprovalType>(
    type: T,
  ): RejectHandler<ApprovalPayloadMap[T]> | undefined {
    return this.registry.getRejectHandler(type);
  }

  async approverSet(requesterId: string, tx: TxCtx): Promise<string[]> {
    return computeApproverSet(requesterId, tx);
  }

  async request<T extends ApprovalType>(
    type: T,
    subject: ApprovalSubject,
    payload: ApprovalPayloadMap[T],
    requesterId: string,
    tx: TxCtx,
  ): Promise<{ approvalRequestId: string }> {
    // Validate payload against schema for this type
    const schema = approvalPayloadSchemas[type];
    schema.parse(payload);

    // FR-ADM-12: Must have at least two active admins in system
    const activeAdmins = await countActiveAdmins(tx);
    if (activeAdmins < 2) {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        "At least two active administrators are required to create an approval request (FR-ADM-12)",
      );
    }

    const [inserted] = await tx
      .insert(approvalRequests)
      .values({
        type,
        subjectType: subject.type,
        subjectId: subject.id,
        payload: payload as Record<string, unknown>,
        requestedBy: requesterId,
        status: "pending",
      })
      .returning({ id: approvalRequests.id });

    if (!inserted) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to create approval request");
    }

    // Audit the creation
    await auditService.log(
      { kind: "system", name: "system" },
      "API-ADM-01 approval.request",
      { type: "approval_request", id: inserted.id },
      null,
      { type, subject, requestedBy: requesterId },
      tx,
    );

    return { approvalRequestId: inserted.id };
  }

  async decide(
    requestId: string,
    adminId: string,
    decision: ApprovalDecisionKind,
    comment: string | undefined,
    tx: TxCtx,
  ): Promise<DecideResult> {
    const [request] = await tx
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, requestId));

    if (!request) {
      throw new AppError(ErrorCode.NOT_FOUND, "Approval request not found");
    }

    // Defence in depth: Service-level check that requester cannot decide own request
    if (request.requestedBy === adminId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Requester cannot approve or reject their own approval request (BR-13)",
      );
    }

    // Check existing decisions by this admin
    const existingDecisions = await tx
      .select()
      .from(approvalDecisions)
      .where(eq(approvalDecisions.requestId, requestId));

    const prior = existingDecisions.find((d) => d.decidedBy === adminId);
    if (prior) {
      if (prior.decision === decision) {
        return {
          status: request.status,
          applied: request.status === "applied",
        };
      }
      throw new AppError(
        ErrorCode.STATE_INVALID,
        "Administrator has already submitted a decision on this approval request",
      );
    }

    // If request already finalised, handle idempotent replay
    if (request.status !== "pending") {
      if (
        (request.status === "approved" || request.status === "applied") &&
        decision === "approve"
      ) {
        return {
          status: request.status,
          applied: request.status === "applied",
        };
      }
      throw new AppError(
        ErrorCode.STATE_INVALID,
        `Cannot decide on request in status: ${request.status}`,
      );
    }

    if (decision === "reject") {
      if (!comment || comment.trim().length === 0) {
        throw new AppError(
          ErrorCode.VALIDATION,
          "Comment is required when rejecting an approval request",
        );
      }

      await tx.insert(approvalDecisions).values({
        requestId,
        decidedBy: adminId,
        decision: "reject",
        comment: comment.trim(),
      });

      await tx
        .update(approvalRequests)
        .set({ status: "rejected" })
        .where(eq(approvalRequests.id, requestId));

      // Execute reject handler if registered
      const rejectHandler = this.getRejectHandler(request.type);
      if (rejectHandler) {
        await rejectHandler(
          {
            requestId,
            type: request.type,
            subject: { type: request.subjectType, id: request.subjectId },
            requestedBy: request.requestedBy,
            decidedBy: adminId,
          },
          request.payload as ApprovalPayload,
          tx,
        );
      }

      await auditService.log(
        { kind: "system", name: "system" },
        "API-ADM-03 approval.reject",
        { type: "approval_request", id: requestId },
        { status: "pending" },
        { status: "rejected", decidedBy: adminId, comment },
        tx,
      );

      return { status: "rejected", applied: false };
    }

    // Decision is "approve"
    await tx.insert(approvalDecisions).values({
      requestId,
      decidedBy: adminId,
      decision: "approve",
      comment: comment?.trim() || null,
    });

    const neededApprovers = await this.approverSet(request.requestedBy, tx);
    const approvedDecisions = [
      ...existingDecisions.filter((d) => d.decision === "approve").map((d) => d.decidedBy),
      adminId,
    ];

    const allApproved =
      neededApprovers.length > 0 &&
      neededApprovers.every((needed) => approvedDecisions.includes(needed));

    if (allApproved) {
      await tx
        .update(approvalRequests)
        .set({ status: "approved" })
        .where(eq(approvalRequests.id, requestId));

      await auditService.log(
        { kind: "system", name: "system" },
        "API-ADM-02 approval.approve",
        { type: "approval_request", id: requestId },
        { status: "pending" },
        { status: "approved", decidedBy: adminId },
        tx,
      );

      return await this.execute(requestId, tx);
    }

    return { status: "pending", applied: false };
  }

  async execute(requestId: string, tx: TxCtx): Promise<DecideResult> {
    const [request] = await tx
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, requestId));

    if (!request) {
      throw new AppError(ErrorCode.NOT_FOUND, "Approval request not found");
    }

    if (request.status !== "approved" && request.status !== "pending") {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        `Cannot execute approval in status: ${request.status}`,
      );
    }

    const handler = this.getApplyHandler(request.type);
    if (!handler) {
      throw new AppError(
        ErrorCode.INTERNAL,
        `No apply handler registered for approval type: ${request.type}`,
      );
    }

    const [lastDecision] = await tx
      .select()
      .from(approvalDecisions)
      .where(
        and(eq(approvalDecisions.requestId, requestId), eq(approvalDecisions.decision, "approve")),
      )
      .orderBy(desc(approvalDecisions.createdAt))
      .limit(1);

    const applyContext: ApplyContext = {
      requestId,
      type: request.type,
      subject: { type: request.subjectType, id: request.subjectId },
      requestedBy: request.requestedBy,
      decidedBy: lastDecision?.decidedBy ?? request.requestedBy,
    };

    try {
      await handler(applyContext, request.payload as ApprovalPayload, tx);

      await tx
        .update(approvalRequests)
        .set({
          status: "applied",
          appliedAt: sql`now()`,
          error: null,
        })
        .where(eq(approvalRequests.id, requestId));

      return { status: "applied", applied: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Apply execution failed";

      await tx
        .update(approvalRequests)
        .set({
          status: "approved",
          error: errorMessage,
        })
        .where(eq(approvalRequests.id, requestId));

      return { status: "approved", applied: false };
    }
  }

  async listApprovals(
    ctx: RequestContext,
    input: ListApprovalsInput,
  ): Promise<ListResult<ApprovalView>> {
    assertPermission(ctx, "approvals.read");

    const database = await this.getDatabase();
    const { limit = 25, filters } = input;
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(approvalRequests.status, filters.status));
    }
    if (filters?.type) {
      conditions.push(eq(approvalRequests.type, filters.type));
    }
    if (filters?.requestedBy) {
      conditions.push(eq(approvalRequests.requestedBy, filters.requestedBy));
    }
    if (filters?.mine) {
      // Must be pending, not requested by caller
      conditions.push(eq(approvalRequests.status, "pending"));
      conditions.push(ne(approvalRequests.requestedBy, ctx.userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const requests = await database
      .select()
      .from(approvalRequests)
      .where(whereClause)
      .orderBy(desc(approvalRequests.createdAt), desc(approvalRequests.id))
      .limit(limit + 1);

    const hasMore = requests.length > limit;
    const items = hasMore ? requests.slice(0, limit) : requests;

    const views: ApprovalView[] = [];

    for (const req of items) {
      const decisions = await database
        .select()
        .from(approvalDecisions)
        .where(eq(approvalDecisions.requestId, req.id))
        .orderBy(approvalDecisions.createdAt);

      // If "mine" filter is requested, filter out requests where caller already decided
      if (filters?.mine && decisions.some((d) => d.decidedBy === ctx.userId)) {
        continue;
      }

      const needed = await computeApproverSet(req.requestedBy, database);
      const decidedIds = new Set(decisions.map((d) => d.decidedBy));
      const pendingApprovers = needed.filter((id) => !decidedIds.has(id));

      const ageHours = (Date.now() - req.createdAt.getTime()) / (1000 * 60 * 60);

      views.push({
        id: req.id,
        type: req.type,
        subject: { type: req.subjectType, id: req.subjectId },
        payloadSummary: payloadSummaryFor(req.type, req.payload),
        payload: req.payload as ApprovalPayload,
        requestedBy: req.requestedBy,
        status: req.status,
        decisions: decisions.map((d) => ({
          decidedBy: d.decidedBy,
          decision: d.decision as ApprovalDecisionKind,
          comment: d.comment,
          createdAt: d.createdAt.toISOString(),
        })),
        pendingApprovers,
        ageHours: Math.max(0, Math.round(ageHours * 10) / 10),
        error: req.error,
        appliedAt: req.appliedAt ? req.appliedAt.toISOString() : null,
      });
    }

    return {
      items: views,
      nextCursor: null,
      total: views.length,
    };
  }

  async getApproval(ctx: RequestContext, input: GetApprovalInput): Promise<ApprovalView> {
    assertPermission(ctx, "approvals.read");

    const database = await this.getDatabase();
    const [req] = await database
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, input.approvalRequestId));

    if (!req) {
      throw new AppError(ErrorCode.NOT_FOUND, "Approval request not found");
    }

    const decisions = await database
      .select()
      .from(approvalDecisions)
      .where(eq(approvalDecisions.requestId, req.id))
      .orderBy(approvalDecisions.createdAt);

    const needed = await computeApproverSet(req.requestedBy, database);
    const decidedIds = new Set(decisions.map((d) => d.decidedBy));
    const pendingApprovers = needed.filter((id) => !decidedIds.has(id));

    const ageHours = (Date.now() - req.createdAt.getTime()) / (1000 * 60 * 60);

    return {
      id: req.id,
      type: req.type,
      subject: { type: req.subjectType, id: req.subjectId },
      payloadSummary: payloadSummaryFor(req.type, req.payload),
      payload: req.payload as ApprovalPayload,
      requestedBy: req.requestedBy,
      status: req.status,
      decisions: decisions.map((d) => ({
        decidedBy: d.decidedBy,
        decision: d.decision as ApprovalDecisionKind,
        comment: d.comment,
        createdAt: d.createdAt.toISOString(),
      })),
      pendingApprovers,
      ageHours: Math.max(0, Math.round(ageHours * 10) / 10),
      error: req.error,
      appliedAt: req.appliedAt ? req.appliedAt.toISOString() : null,
    };
  }

  async approveRequest(
    ctx: RequestContext,
    input: ApproveRequestInput,
    tx?: TxCtx,
  ): Promise<DecideResult> {
    assertPermission(ctx, "approvals.decide");

    const { withTx } = await import("@/lib/db");
    return await withTx(async (actionTx) => {
      return await this.decide(
        input.approvalRequestId,
        ctx.userId,
        "approve",
        input.comment,
        actionTx,
      );
    }, tx);
  }

  async rejectRequest(
    ctx: RequestContext,
    input: RejectRequestInput,
    tx?: TxCtx,
  ): Promise<DecideResult> {
    assertPermission(ctx, "approvals.decide");

    const { withTx } = await import("@/lib/db");
    return await withTx(async (actionTx) => {
      return await this.decide(
        input.approvalRequestId,
        ctx.userId,
        "reject",
        input.comment,
        actionTx,
      );
    }, tx);
  }

  async cancelRequest(
    ctx: RequestContext,
    input: CancelRequestInput,
    tx?: TxCtx,
  ): Promise<DecideResult> {
    const { withTx } = await import("@/lib/db");
    return await withTx(async (actionTx) => {
      const [req] = await actionTx
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, input.approvalRequestId));

      if (!req) {
        throw new AppError(ErrorCode.NOT_FOUND, "Approval request not found");
      }

      if (req.requestedBy !== ctx.userId) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          "Only the original requester can cancel an approval request",
        );
      }

      if (req.status !== "pending") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot cancel approval request in status: ${req.status}`,
        );
      }

      await actionTx
        .update(approvalRequests)
        .set({ status: "cancelled" })
        .where(eq(approvalRequests.id, req.id));

      await auditService.log(
        ctx,
        "API-ADM-04 approval.cancel",
        { type: "approval_request", id: req.id },
        { status: "pending" },
        { status: "cancelled" },
        actionTx,
      );

      return { status: "cancelled", applied: false };
    }, tx);
  }

  async retryApply(ctx: RequestContext, input: RetryApplyInput, tx?: TxCtx): Promise<DecideResult> {
    assertPermission(ctx, "approvals.decide");

    if (!ctx.roles.includes("super_admin")) {
      throw new AppError(ErrorCode.FORBIDDEN, "Only super administrators can retry approval apply");
    }

    const { withTx } = await import("@/lib/db");
    return await withTx(async (actionTx) => {
      const [req] = await actionTx
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, input.approvalRequestId));

      if (!req) {
        throw new AppError(ErrorCode.NOT_FOUND, "Approval request not found");
      }

      if (req.status !== "approved") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot retry apply on request in status: ${req.status}`,
        );
      }

      return await this.execute(req.id, actionTx);
    }, tx);
  }
}

export function createApprovalsService(
  registry?: InMemoryApplyHandlerRegistry,
  getDb?: () => DbOrTx,
): ApprovalsService {
  return new DefaultApprovalsService(registry, getDb);
}

export const approvalsService: ApprovalsService = new DefaultApprovalsService();
