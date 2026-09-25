/**
 * AI chat (docs/05 §9): conversations, chat_messages, chat_usage_daily, knowledge_chunks, prompt_versions.
 * Transcripts are purged 12 months after `started_at` (`purge_after`, D-1503) and immediately on account
 * deletion (cascade). Knowledge retrieval is Postgres full-text (`search_vector` + GIN, A-304).
 */
import { type SQL, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tsvector } from "./catalog"; // same customType as products.search_vector
import { queries } from "./queries";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const chatRole = pgEnum("chat_role", ["user", "assistant", "system", "menu"]);
/** Sources indexed into knowledge_chunks (docs/06 API-CHAT-13). */
export const knowledgeSourceType = pgEnum("knowledge_source_type", [
  "product",
  "offering",
  "service",
  "faq",
  "legal",
  "case_study",
]);

/** prompt_versions — versioned system prompts; exactly one `is_active` (docs/09 §11). */
export const promptVersions = pgTable(
  "prompt_versions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    version: integer("version").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("prompt_versions_name_version_uq").on(t.name, t.version),
    uniqueIndex("prompt_versions_single_active_uq")
      .on(t.isActive)
      .where(sql`is_active`),
  ],
);

/** T-conversations */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: ts("started_at").notNull().defaultNow(),
    endedAt: ts("ended_at"),
    escalatedQueryId: uuid("escalated_query_id").references((): AnyPgColumn => queries.id, {
      onDelete: "set null",
    }),
    /** Snapshot of `site_settings.ai_model` at start. */
    model: text("model").notNull(),
    promptVersionId: uuid("prompt_version_id")
      .notNull()
      .references(() => promptVersions.id),
    /** started_at + 12 months; `retention.purge` deletes past this date. */
    purgeAfter: date("purge_after", { mode: "string" }).notNull(),
  },
  (t) => [
    index("conversations_user_started_idx").on(t.userId, t.startedAt),
    index("conversations_purge_after_idx").on(t.purgeAfter),
    index("conversations_prompt_version_idx").on(t.promptVersionId),
    index("conversations_escalated_query_idx").on(t.escalatedQueryId),
  ],
);

/** T-chat_messages */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: chatRole("role").notNull(),
    content: text("content").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    retrievedChunkIds: uuid("retrieved_chunk_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_messages_conversation_created_idx").on(t.conversationId, t.createdAt)],
);

/** chat_usage_daily — per-user and platform-wide daily call counters (D-708). `scope` = user id or 'platform'. */
export const chatUsageDaily = pgTable(
  "chat_usage_daily",
  {
    scope: text("scope").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.scope, t.day] }), index("chat_usage_daily_day_idx").on(t.day)],
);

/** knowledge_chunks — plain-text chunks rebuilt from published content; `search_vector` is generated. */
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceType: knowledgeSourceType("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', coalesce(${knowledgeChunks.title}, '')), 'A') || setweight(to_tsvector('english', coalesce(${knowledgeChunks.body}, '')), 'B')`,
    ),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("knowledge_chunks_search_idx").using("gin", t.searchVector),
    index("knowledge_chunks_source_idx").on(t.sourceType, t.sourceId),
  ],
);

export type PromptVersion = typeof promptVersions.$inferSelect;
export type NewPromptVersion = typeof promptVersions.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ChatUsageDaily = typeof chatUsageDaily.$inferSelect;
export type NewChatUsageDaily = typeof chatUsageDaily.$inferInsert;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;
