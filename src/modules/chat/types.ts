/**
 * Chatbot — docs/06 §2.9 API-CHAT-06..13, API-CHAT-15 (`modules/chat`), §3.2 `/api/chat` SSE
 * contract, §3.3 `knowledge.reindex` / `retention.purge`, docs/04 §9, docs/09 §11, D-708 (caps),
 * D-1503 (12-month retention), MASTER_SPEC §7 "Chatbot contact menu".
 */
import { z } from "zod";

export const uuid = z.uuid();
export const isoDateTime = z.iso.datetime({ offset: true });

export const CHAT_ROLES = ["user", "assistant", "system", "menu"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export const KNOWLEDGE_SOURCE_TYPES = [
  "product",
  "offering",
  "service",
  "faq",
  "legal",
  "case_study",
] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const MENU_INTENTS = [
  "order_status",
  "downloads",
  "contact",
  "renewal",
  "invoices",
  "talk_to_human",
  "back",
] as const;
export type MenuIntent = (typeof MENU_INTENTS)[number];

// ---------------------------------------------------------------------------------------------
// Menu model (`modules/chat/menus.ts`, no LLM)
// ---------------------------------------------------------------------------------------------

export const menuActionSchema = z.union([
  z
    .object({
      label: z.string(),
      intent: z.enum(MENU_INTENTS),
      args: z.object({ orderNo: z.string() }).strict().optional(),
    })
    .strict(),
  z.object({ label: z.string(), href: z.string() }).strict(),
]);
export type MenuAction = z.infer<typeof menuActionSchema>;

export const menuNodeSchema = z
  .object({ intent: z.enum(MENU_INTENTS), label: z.string(), description: z.string().optional() })
  .strict();
export type MenuNode = z.infer<typeof menuNodeSchema>;

/** A `role='menu'` bubble: text plus quick-reply actions / data cards (SCR-ACC-06). */
export const menuMessageSchema = z
  .object({
    role: z.literal("menu"),
    content: z.string(),
    actions: z.array(menuActionSchema),
    card: z
      .discriminatedUnion("kind", [
        z
          .object({
            kind: z.literal("order"),
            orderNo: z.string(),
            status: z.string(),
            href: z.string(),
          })
          .strict(),
        z
          .object({
            kind: z.literal("downloads"),
            entitlementId: uuid,
            product: z.string(),
            files: z.array(z.object({ mediaId: uuid, name: z.string(), version: z.string() })),
            downloadsRemaining: z.number().int().nonnegative().nullable(),
          })
          .strict(),
        z
          .object({
            kind: z.literal("renewal"),
            entitlementId: uuid,
            product: z.string(),
            periodEnd: isoDateTime,
            canRenew: z.boolean(),
          })
          .strict(),
        z
          .object({
            kind: z.literal("invoice"),
            invoiceNo: z.string(),
            orderNo: z.string(),
            href: z.string(),
          })
          .strict(),
      ])
      .optional(),
  })
  .strict();
export type MenuMessage = z.infer<typeof menuMessageSchema>;

// ---------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------

/** API-CHAT-06 `startConversation` — `chat.use`, verified email; `A: chat_started`. */
export const startConversationSchema = z
  .object({
    entry: z.enum(["menu", "free"]).optional(),
    context: z
      .object({
        productSlug: z.string().trim().max(80).optional(),
        orderNo: z.string().trim().max(20).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type StartConversationInput = z.infer<typeof startConversationSchema>;

/** API-CHAT-07 `menuIntent` — resolved from the caller's own rows; `contact` → escalation offer. */
export const menuIntentSchema = z
  .object({
    conversationId: uuid,
    intent: z.enum(MENU_INTENTS),
    args: z
      .object({ orderNo: z.string().trim().max(20).optional() })
      .strict()
      .optional(),
  })
  .strict();
export type MenuIntentInput = z.infer<typeof menuIntentSchema>;

/** API-CHAT-08 `sendMessage` → `POST /api/chat` body (docs/06 §3.2); text trimmed, control chars removed (docs/09 §11). */
export const sendMessageSchema = z
  .object({
    conversationId: uuid,
    content: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      // eslint-disable-next-line no-control-regex
      .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")),
  })
  .strict();
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** API-CHAT-09 `escalateConversation` — `STATE_INVALID` when already escalated. */
export const escalateConversationSchema = z
  .object({
    conversationId: uuid,
    subject: z.string().trim().min(3).max(160).optional(),
    summary: z.string().trim().max(2000).optional(),
  })
  .strict();
export type EscalateConversationInput = z.infer<typeof escalateConversationSchema>;

/** API-CHAT-10 `endConversation`. */
export const endConversationSchema = z.object({ conversationId: uuid }).strict();
export type EndConversationInput = z.infer<typeof endConversationSchema>;

/** API-CHAT-10 `listMyConversations`. */
export const listMyConversationsSchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .strict();
export type ListMyConversationsInput = z.infer<typeof listMyConversationsSchema>;

/** API-CHAT-11 `listConversationsAdmin` — `chat.transcripts.read`. */
export const listConversationsAdminSchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(25),
    sort: z.enum(["startedAt:asc", "startedAt:desc"]).optional(),
    filters: z
      .object({
        userId: uuid.optional(),
        escalated: z.boolean().optional(),
        dateFrom: isoDateTime.optional(),
        dateTo: isoDateTime.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type ListConversationsAdminInput = z.infer<typeof listConversationsAdminSchema>;

/** API-CHAT-11 `getTranscript`. */
export const getTranscriptSchema = z.object({ conversationId: uuid }).strict();
export type GetTranscriptInput = z.infer<typeof getTranscriptSchema>;

/** API-CHAT-12 `listPromptVersions` — `chat.prompts.write`. */
export const listPromptVersionsSchema = z
  .object({ name: z.string().trim().max(80).optional() })
  .strict();
export type ListPromptVersionsInput = z.infer<typeof listPromptVersionsSchema>;

/** API-CHAT-12 `createPromptVersion` — new `(name, version+1)` row, inactive until activated; audited. */
export const createPromptVersionSchema = z
  .object({ name: z.string().trim().min(1).max(80), systemPrompt: z.string().min(1).max(20000) })
  .strict();
export type CreatePromptVersionInput = z.infer<typeof createPromptVersionSchema>;

/** API-CHAT-12 `activatePromptVersion` — exactly one `is_active` (partial unique index); audited. */
export const activatePromptVersionSchema = z.object({ promptVersionId: uuid }).strict();
export type ActivatePromptVersionInput = z.infer<typeof activatePromptVersionSchema>;

/** API-CHAT-12 rollback (docs/04 §9 "roll back"): re-activates the version that was active before the current one. */
export const rollbackPromptVersionSchema = z
  .object({ name: z.string().trim().min(1).max(80) })
  .strict();
export type RollbackPromptVersionInput = z.infer<typeof rollbackPromptVersionSchema>;

/** API-CHAT-13 `reindexKnowledge` — `chat.prompts.write`; all sources when omitted. */
export const reindexKnowledgeSchema = z
  .object({ sourceType: z.enum(KNOWLEDGE_SOURCE_TYPES).optional() })
  .strict();
export type ReindexKnowledgeInput = z.infer<typeof reindexKnowledgeSchema>;

/** API-CHAT-15 `confirmLeadCapture` — prefilled from `lead_intent`, editable; `leads(source='chatbot')`. */
export const confirmLeadCaptureSchema = z
  .object({
    conversationId: uuid,
    name: z.string().trim().min(1).max(120).optional(),
    email: z.email().max(254).optional(),
    need: z.string().trim().min(10).max(2000),
  })
  .strict();
export type ConfirmLeadCaptureInput = z.infer<typeof confirmLeadCaptureSchema>;

// ---------------------------------------------------------------------------------------------
// SSE contract (docs/06 §3.2) — one Zod schema per `event:` name plus the union
// ---------------------------------------------------------------------------------------------

export const chatUsageSchema = z
  .object({
    userRemaining: z.number().int().nonnegative(),
    platformRemaining: z.number().int().nonnegative(),
  })
  .strict();
export type ChatUsage = z.infer<typeof chatUsageSchema>;

export const citationSchema = z
  .object({ title: z.string(), sourceType: z.enum(KNOWLEDGE_SOURCE_TYPES), href: z.string() })
  .strict();
export type Citation = z.infer<typeof citationSchema>;

export const FALLBACK_REASONS = ["refusal", "timeout", "unavailable", "limit"] as const;
export type FallbackReason = (typeof FALLBACK_REASONS)[number];

export const chatSseEventSchema = z.discriminatedUnion("event", [
  z
    .object({
      event: z.literal("meta"),
      data: z.object({ messageId: uuid, usage: chatUsageSchema }).strict(),
    })
    .strict(),
  z.object({ event: z.literal("delta"), data: z.object({ text: z.string() }).strict() }).strict(),
  z
    .object({
      event: z.literal("citations"),
      data: z.object({ chunks: z.array(citationSchema) }).strict(),
    })
    .strict(),
  z
    .object({
      event: z.literal("lead_intent"),
      data: z
        .object({
          name: z.string().optional(),
          email: z.string().optional(),
          need: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      event: z.literal("fallback"),
      data: z
        .object({
          menu: z.array(menuNodeSchema),
          reason: z.enum(FALLBACK_REASONS),
          message: z.string().optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      event: z.literal("done"),
      data: z
        .object({
          tokensIn: z.number().int().nonnegative(),
          tokensOut: z.number().int().nonnegative(),
          stopReason: z.enum(["end_turn", "max_tokens", "tool_use", "refusal", "timeout", "error"]),
        })
        .strict(),
    })
    .strict(),
  /** Mid-stream failure after headers were sent (the pre-flight errors are plain HTTP JSON). */
  z
    .object({
      event: z.literal("error"),
      data: z.object({ code: z.string(), message: z.string() }).strict(),
    })
    .strict(),
]);
export type ChatSseEvent = z.infer<typeof chatSseEventSchema>;
export type ChatSseEventName = ChatSseEvent["event"];
export const CHAT_SSE_EVENTS = [
  "meta",
  "delta",
  "citations",
  "lead_intent",
  "fallback",
  "done",
  "error",
] as const satisfies readonly ChatSseEventName[];

// ---------------------------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------------------------

export interface StartConversationResult {
  conversationId: string;
  menu: MenuNode[];
  usage: ChatUsage;
}

export interface MenuIntentResult {
  messages: MenuMessage[];
}

export interface EscalateConversationResult {
  queryId: string;
}

export interface ConversationSummary {
  conversationId: string;
  startedAt: string;
  endedAt: string | null;
  escalatedQueryId: string | null;
  messageCount: number;
  lastMessagePreview: string | null;
}

export interface TranscriptMessage {
  messageId: string;
  role: ChatRole;
  content: string;
  tokensIn: number;
  tokensOut: number;
  retrievedChunks: Array<{ chunkId: string; title: string; sourceType: KnowledgeSourceType }>;
  createdAt: string;
}

/** API-CHAT-11 `getTranscript`. */
export interface Transcript {
  conversation: ConversationSummary & {
    userId: string;
    model: string;
    promptVersionId: string;
    purgeAfter: string;
  };
  messages: TranscriptMessage[];
  usage: { userToday: number; userCap: number; platformToday: number; platformCap: number };
}

export interface PromptVersionRow {
  promptVersionId: string;
  name: string;
  version: number;
  isActive: boolean;
  systemPrompt: string;
  createdBy: { id: string; name: string | null } | null;
  createdAt: string;
}

export interface PromptVersionsResult {
  versions: PromptVersionRow[];
}

export interface ReindexResult {
  chunks: number;
}

/** Daily caps from `site_settings` (D-708). */
export interface ChatCaps {
  userDaily: number;
  platformDaily: number;
}

export interface CapCheck {
  allowed: boolean;
  usage: ChatUsage;
  /** Which cap blocked (`null` when allowed). */
  exceeded: "user" | "platform" | null;
}

export interface RetrievedChunk {
  chunkId: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  body: string;
  href: string;
  rank: number;
}

export interface KnowledgeReindexDetail extends Record<string, unknown> {
  chunks: number;
  bySource: Partial<Record<KnowledgeSourceType, number>>;
}

export interface RetentionPurgeDetail extends Record<string, unknown> {
  conversations: number;
  messages: number;
}
