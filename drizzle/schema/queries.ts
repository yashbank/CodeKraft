/**
 * Support queries (docs/05 §9 T-queries, query_messages). A query is a 7-year record class (BR-18):
 * the linked chat conversation may be purged, the thread keeps its excerpt.
 *
 * `queries.conversation_id` ↔ `conversations.escalated_query_id` is a same-domain cycle between this
 * file and ./chat — both sides use lazy `AnyPgColumn` references, which drizzle supports.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { products } from "./catalog";
import { conversations } from "./chat";
import { orders } from "./commerce";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const querySource = pgEnum("query_source", [
  "form",
  "chatbot",
  "order",
  "dashboard",
  "email",
  "manual",
]);
export const queryStatus = pgEnum("query_status", [
  "open",
  "waiting_customer",
  "resolved",
  "closed",
]);
export const messageAuthorKind = pgEnum("message_author_kind", ["customer", "admin", "system"]);

/** T-queries */
export const queries = pgTable(
  "queries",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Set when the thread was opened without an account (form / inbound email). */
    guestEmail: text("guest_email"),
    subject: text("subject").notNull(),
    source: querySource("source").notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    status: queryStatus("status").notNull().default("open"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").references((): AnyPgColumn => conversations.id, {
      onDelete: "set null",
    }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("queries_user_idx").on(t.userId),
    index("queries_status_updated_idx").on(t.status, t.updatedAt),
    index("queries_assigned_to_idx").on(t.assignedTo),
    index("queries_order_idx").on(t.orderId),
    index("queries_product_idx").on(t.productId),
    index("queries_conversation_idx").on(t.conversationId),
  ],
);

/** query_messages — thread messages; `attachments` holds media ids. */
export const queryMessages = pgTable(
  "query_messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    queryId: uuid("query_id")
      .notNull()
      .references(() => queries.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    authorKind: messageAuthorKind("author_kind").notNull(),
    bodyJson: jsonb("body_json").notNull(),
    attachments: uuid("attachments")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`), // media ids (FK not enforceable on arrays)
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("query_messages_query_created_idx").on(t.queryId, t.createdAt)],
);

export type Query = typeof queries.$inferSelect;
export type NewQuery = typeof queries.$inferInsert;
export type QueryMessage = typeof queryMessages.$inferSelect;
export type NewQueryMessage = typeof queryMessages.$inferInsert;
