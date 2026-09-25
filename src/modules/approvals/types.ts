/**
 * Approvals — the nine approval types, one Zod payload per type, and the API-ADM-01..04 inputs
 * (docs/06 §2.7; docs/04 §7.4; MASTER_SPEC §4.5, §7 "Approver set"; BR-13).
 *
 * Payload schemas are owned by the requesting modules where they are also action inputs
 * (payout.record = `recordPayoutInput`, ledger.adjustment = `proposeAdjustmentInput`,
 * refund.issue = `refundIssuePayload`, project_order.split = `projectOrderSplitPayload`); the
 * catalog-side payloads (publish / ownership / archive / delete) and `admin.user_change` are
 * transcribed here from docs/06 §2.2 / §2.7 so this module can parse any stored payload.
 */
import { z } from "zod";
import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalStatus,
  ApprovalType,
} from "../../../drizzle/schema/approvals";
import {
  isoDateTimeSchema as zIsoTimestamp,
  listParams as zListParams,
  trimmedString as zTrimmed,
  uuidSchema as zUuid,
} from "@/modules/_shared/zod";
import { projectOrderSplitPayload } from "@/modules/orders/types";
import { refundIssuePayload } from "@/modules/payments/types";
import { ledgerAdjustmentPayload, payoutRecordPayload } from "@/modules/finance/types";

export const APPROVAL_TYPES = [
  "product.publish",
  "ownership.change",
  "ledger.adjustment",
  "refund.issue",
  "payout.record",
  "product.archive",
  "product.delete",
  "admin.user_change",
  "project_order.split",
] as const satisfies readonly ApprovalType[];
export const zApprovalType = z.enum(APPROVAL_TYPES);

export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "applied",
  "cancelled",
] as const satisfies readonly ApprovalStatus[];

export const APPROVAL_DECISIONS = ["approve", "reject"] as const;
export type ApprovalDecisionKind = (typeof APPROVAL_DECISIONS)[number];

/** `pending → approved → applied`; `approved` with `error` may be retried (API-ADM-04). */
export const APPROVAL_STATUS_TRANSITIONS: Readonly<
  Record<ApprovalStatus, readonly ApprovalStatus[]>
> = Object.freeze({
  pending: ["approved", "rejected", "cancelled"],
  approved: ["applied"],
  rejected: [],
  applied: [],
  cancelled: [],
});

// ---------------------------------------------------------------------------------------------
// Payloads per type
// ---------------------------------------------------------------------------------------------

/** API-CAT-11 `submitForApproval` → `{ productId, publishAt }`. */
export const productPublishPayload = z
  .object({ productId: zUuid, publishAt: zIsoTimestamp.optional() })
  .strict();
/** API-CAT-16 `proposeOwnership` → `{ ownershipId }` (the pending version). */
export const ownershipChangePayload = z
  .object({ ownershipId: zUuid, productId: zUuid.optional() })
  .strict();
/** API-CAT-14 `requestArchive` / `requestDelete`. */
export const productArchivePayload = z
  .object({ productId: zUuid, reason: zTrimmed(1, 500) })
  .strict();
export const productDeletePayload = productArchivePayload;
/** API-ADM-11 `inviteAdmin` / `changeAdminRole` / `removeAdmin`. */
export const ADMIN_CLASS_TARGET_ROLES = ["admin", "super_admin", "staff"] as const;
export const adminUserChangePayload = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("invite"),
      email: z.email().trim().max(254),
      role: z.enum(ADMIN_CLASS_TARGET_ROLES),
      partner: z
        .object({ displayName: zTrimmed(1, 120) })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("change_role"),
      userId: zUuid,
      role: z.enum(ADMIN_CLASS_TARGET_ROLES),
    })
    .strict(),
  z.object({ kind: z.literal("remove"), userId: zUuid }).strict(),
]);

export const approvalPayloadSchemas = {
  "product.publish": productPublishPayload,
  "ownership.change": ownershipChangePayload,
  "ledger.adjustment": ledgerAdjustmentPayload,
  "refund.issue": refundIssuePayload,
  "payout.record": payoutRecordPayload,
  "product.archive": productArchivePayload,
  "product.delete": productDeletePayload,
  "admin.user_change": adminUserChangePayload,
  "project_order.split": projectOrderSplitPayload,
} as const satisfies Record<ApprovalType, z.ZodType>;

export type ApprovalPayloadMap = {
  [T in ApprovalType]: z.infer<(typeof approvalPayloadSchemas)[T]>;
};
export type ApprovalPayload<T extends ApprovalType = ApprovalType> = ApprovalPayloadMap[T];

export function parseApprovalPayload<T extends ApprovalType>(
  type: T,
  raw: unknown,
): ApprovalPayloadMap[T] {
  return approvalPayloadSchemas[type].parse(raw) as ApprovalPayloadMap[T];
}

/** Which API row applies each type (docs/06), and the `subject_type` each request carries. */
export const APPROVAL_TYPE_INFO: Readonly<
  Record<ApprovalType, { applyApi: string; subjectType: string; onRejected: string }>
> = Object.freeze({
  "product.publish": {
    applyApi: "API-CAT-12",
    subjectType: "product",
    onRejected: "product back to draft",
  },
  "ownership.change": {
    applyApi: "API-CAT-17",
    subjectType: "product_ownership",
    onRejected: "pending version deleted",
  },
  "ledger.adjustment": { applyApi: "API-FIN-08", subjectType: "ledger", onRejected: "nothing" },
  "refund.issue": {
    applyApi: "API-PAY-06",
    subjectType: "refund",
    onRejected: "refunds row deleted",
  },
  "payout.record": { applyApi: "API-FIN-05", subjectType: "partner", onRejected: "nothing" },
  "product.archive": { applyApi: "API-CAT-15", subjectType: "product", onRejected: "nothing" },
  "product.delete": { applyApi: "API-CAT-15", subjectType: "product", onRejected: "nothing" },
  "admin.user_change": { applyApi: "API-ADM-11", subjectType: "user", onRejected: "nothing" },
  "project_order.split": { applyApi: "API-COM-14", subjectType: "order", onRejected: "nothing" },
});

// ---------------------------------------------------------------------------------------------
// request (internal) — `approvals.request(type, subject, payload, requesterId, tx)`
// ---------------------------------------------------------------------------------------------

export const zApprovalSubject = z.object({ type: zTrimmed(1, 60), id: zUuid }).strict();
export type ApprovalSubject = z.infer<typeof zApprovalSubject>;

export const requestApprovalInput = z
  .object({
    type: zApprovalType,
    subject: zApprovalSubject,
    payload: z.record(z.string(), z.unknown()),
  })
  .strict()
  .superRefine((r, ctx) => {
    const parsed = approvalPayloadSchemas[r.type].safeParse(r.payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ ...issue, path: ["payload", ...issue.path] });
      }
    }
  });
export type RequestApprovalInput = z.infer<typeof requestApprovalInput>;

// ---------------------------------------------------------------------------------------------
// API-ADM-01 listApprovals / getApproval (query)
// ---------------------------------------------------------------------------------------------

export const listApprovalsInput = zListParams(
  ["createdAt"],
  z
    .object({
      status: z.enum(APPROVAL_STATUSES).optional(),
      type: zApprovalType.optional(),
      requestedBy: zUuid.optional(),
      /** Requests the caller must decide on (pending, not their own). */
      mine: z.boolean().optional(),
    })
    .strict(),
);
export type ListApprovalsInput = z.infer<typeof listApprovalsInput>;

export const getApprovalInput = z.object({ approvalRequestId: zUuid }).strict();
export type GetApprovalInput = z.infer<typeof getApprovalInput>;

export interface ApprovalDecisionView {
  decidedBy: string;
  decision: ApprovalDecisionKind;
  comment: string | null;
  createdAt: string;
}

export interface ApprovalView {
  id: string;
  type: ApprovalType;
  subject: ApprovalSubject;
  payloadSummary: string;
  payload: ApprovalPayload;
  requestedBy: string;
  status: ApprovalStatus;
  decisions: ApprovalDecisionView[];
  /** Admin-class users (except the requester) who have not decided yet (BR-13, A-1101). */
  pendingApprovers: string[];
  ageHours: number;
  error: string | null;
  appliedAt: string | null;
}

// ---------------------------------------------------------------------------------------------
// API-ADM-02 approveRequest, API-ADM-03 rejectRequest, API-ADM-04 cancelRequest / retryApply
// ---------------------------------------------------------------------------------------------

export const approveRequestInput = z
  .object({ approvalRequestId: zUuid, comment: zTrimmed(0, 500).optional() })
  .strict();
export type ApproveRequestInput = z.infer<typeof approveRequestInput>;

export const rejectRequestInput = z
  .object({ approvalRequestId: zUuid, comment: zTrimmed(1, 500) })
  .strict();
export type RejectRequestInput = z.infer<typeof rejectRequestInput>;

export const cancelRequestInput = z.object({ approvalRequestId: zUuid }).strict();
export type CancelRequestInput = z.infer<typeof cancelRequestInput>;
export const retryApplyInput = cancelRequestInput;
export type RetryApplyInput = CancelRequestInput;

export interface DecideResult {
  status: ApprovalStatus;
  /** True when this decision completed the approver set and `execute()` succeeded. */
  applied: boolean;
}

export type {
  ApprovalDecision as ApprovalDecisionRow,
  ApprovalRequest,
  ApprovalStatus,
  ApprovalType,
};
