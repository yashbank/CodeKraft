/**
 * Approvals (docs/05 §8, T-approval_requests, approval_decisions). One generic dual-approval
 * mechanism for every gated admin action (MASTER_SPEC §4.5, BR-13). The requester is never
 * counted as an approver — enforced by the `approver_is_requester` trigger (drizzle/custom, P2.4).
 */
import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** The nine approval types (docs/05 §8; `project_order.split` per MASTER_SPEC §7 "Project order splits"). */
export const approvalType = pgEnum("approval_type", [
  "product.publish",
  "ownership.change",
  "ledger.adjustment",
  "refund.issue",
  "payout.record",
  "product.archive",
  "product.delete",
  "admin.user_change",
  "project_order.split",
]);

export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "applied",
  "cancelled",
]);

export const approvalDecision = pgEnum("approval_decision", ["approve", "reject"]);

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    type: approvalType("type").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),
    status: approvalStatus("status").notNull().default("pending"),
    appliedAt: ts("applied_at"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("approval_requests_status_idx").on(t.status, t.createdAt),
    index("approval_requests_subject_idx").on(t.subjectType, t.subjectId),
    index("approval_requests_requested_by_idx").on(t.requestedBy),
    index("approval_requests_type_idx").on(t.type),
  ],
);

export const approvalDecisions = pgTable(
  "approval_decisions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    requestId: uuid("request_id")
      .notNull()
      .references(() => approvalRequests.id, { onDelete: "cascade" }),
    /** Trigger `approver_is_requester` rejects decided_by = approval_requests.requested_by (BR-13). */
    decidedBy: uuid("decided_by")
      .notNull()
      .references(() => users.id),
    decision: approvalDecision("decision").notNull(),
    comment: text("comment"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("approval_decisions_request_decider_uq").on(t.requestId, t.decidedBy),
    index("approval_decisions_decided_by_idx").on(t.decidedBy),
  ],
);

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
export type ApprovalDecision = typeof approvalDecisions.$inferSelect;
export type NewApprovalDecision = typeof approvalDecisions.$inferInsert;
export type ApprovalType = (typeof approvalType.enumValues)[number];
export type ApprovalStatus = (typeof approvalStatus.enumValues)[number];
