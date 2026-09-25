/**
 * Dual-approval factories (docs/05 §8, BR-13). The default decider is a different admin than the
 * requester, so the `approver_is_requester` trigger passes; pass `decidedBy: request.requestedBy`
 * to prove it fires.
 */
import {
  type ApprovalDecision,
  type ApprovalRequest,
  type ApprovalStatus,
  type ApprovalType,
  approvalDecisions,
  approvalRequests,
} from "../../drizzle/schema/approvals";
import { createProduct } from "./catalog";
import { type FactoryDb, one, toFactoryDb } from "./context";
import { createAdmin } from "./users";

export interface CreateApprovalRequestOptions {
  type?: ApprovalType;
  subjectType?: string;
  /** Default: a new draft product (subject of a `product.publish`). */
  subjectId?: string;
  payload?: Record<string, unknown>;
  /** Default: a new admin. */
  requestedBy?: string;
  status?: ApprovalStatus;
  appliedAt?: Date | null;
  error?: string | null;
}

export async function createApprovalRequest(
  opts: CreateApprovalRequestOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<ApprovalRequest> {
  const requestedBy = opts.requestedBy ?? (await createAdmin({}, db)).id;
  const subjectId =
    opts.subjectId ?? (await createProduct({ status: "draft", createdBy: requestedBy }, db)).id;
  const status = opts.status ?? "pending";
  return one(
    await db
      .insert(approvalRequests)
      .values({
        type: opts.type ?? "product.publish",
        subjectType: opts.subjectType ?? "product",
        subjectId,
        payload: opts.payload ?? {},
        requestedBy,
        status,
        appliedAt: opts.appliedAt ?? (status === "applied" ? new Date() : null),
        error: opts.error ?? null,
      })
      .returning(),
    "approval_requests",
  );
}

export interface CreateApprovalDecisionOptions {
  request: Pick<ApprovalRequest, "id" | "requestedBy">;
  /** Default: a new admin (never the requester). */
  decidedBy?: string;
  decision?: ApprovalDecision["decision"];
  comment?: string | null;
}

export async function createApprovalDecision(
  opts: CreateApprovalDecisionOptions,
  db: FactoryDb = toFactoryDb(),
): Promise<ApprovalDecision> {
  const decidedBy = opts.decidedBy ?? (await createAdmin({}, db)).id;
  return one(
    await db
      .insert(approvalDecisions)
      .values({
        requestId: opts.request.id,
        decidedBy,
        decision: opts.decision ?? "approve",
        comment: opts.comment ?? null,
      })
      .returning(),
    "approval_decisions",
  );
}
