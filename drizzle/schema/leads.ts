/**
 * Leads (docs/05 §9 T-leads, lead_activities). Retained 7 years and never deleted on customer account
 * deletion (D-1503, BR-18) — user FKs therefore `set null`, never cascade.
 */
import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const leadSource = pgEnum("lead_source", [
  "inquiry_form",
  "product_cta",
  "chatbot",
  "manual",
]);
export const leadStatus = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
]);
export const leadPriority = pgEnum("lead_priority", ["low", "normal", "high"]);
export const leadActivityKind = pgEnum("lead_activity_kind", [
  "note",
  "status_change",
  "assignment",
  "follow_up_set",
  "email",
  "call",
]);

/** T-leads */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    source: leadSource("source").notNull(),
    productId: uuid("product_id"), // FK → products.id (P2.4)
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    company: text("company"),
    message: text("message"),
    serviceInterest: text("service_interest")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    budgetHint: text("budget_hint"),
    status: leadStatus("status").notNull().default("new"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    priority: leadPriority("priority").notNull().default("normal"),
    nextFollowUpAt: ts("next_follow_up_at"),
    lostReason: text("lost_reason"),
    wonOrderId: uuid("won_order_id"), // FK → orders.id (P2.4)
    turnstileVerified: boolean("turnstile_verified").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("leads_status_idx").on(t.status),
    index("leads_assigned_to_idx").on(t.assignedTo),
    index("leads_next_follow_up_idx").on(t.nextFollowUpAt), // overdue digest (R-701)
    index("leads_product_idx").on(t.productId),
    index("leads_user_idx").on(t.userId),
    index("leads_created_idx").on(t.createdAt),
  ],
);

/** lead_activities — timeline entries on a lead. */
export const leadActivities = pgTable(
  "lead_activities",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    kind: leadActivityKind("kind").notNull(),
    body: text("body"),
    meta: jsonb("meta"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("lead_activities_lead_created_idx").on(t.leadId, t.createdAt)],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type NewLeadActivity = typeof leadActivities.$inferInsert;
