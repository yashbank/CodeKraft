/**
 * Audit log (docs/05 §8, T-audit_logs). Every admin mutation writes one row in the same
 * transaction (MASTER_SPEC §4.9, D-1104). Append-only — trigger in drizzle/custom (P2.4).
 */
import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** null for system actors (jobs, webhooks) or after the actor was anonymised (BR-18). */
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    /** Correlation id of the HTTP request / job run that produced the row. */
    requestId: text("request_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_subject_idx").on(t.subjectType, t.subjectId),
    index("audit_logs_actor_idx").on(t.actorId, t.createdAt),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
