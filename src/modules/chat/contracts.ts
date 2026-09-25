/**
 * Chat service contract — docs/06 §2.9 API-CHAT-06..13, API-CHAT-15, §3.2 `/api/chat`, §3.3
 * `knowledge.reindex` / `retention.purge`, §5.6 escalation, docs/04 §9, docs/09 §11, D-708.
 * Implementation in P6.
 */
import type { RequestContext } from "@/lib/authz/context";
import type { TxCtx } from "@/lib/db";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import type { ListResult } from "@/modules/_shared/zod";
import type { LLMProvider } from "./llm";
import type {
  ActivatePromptVersionInput,
  CapCheck,
  ChatCaps,
  ChatSseEvent,
  ConfirmLeadCaptureInput,
  ConversationSummary,
  CreatePromptVersionInput,
  EndConversationInput,
  EscalateConversationInput,
  EscalateConversationResult,
  GetTranscriptInput,
  KnowledgeReindexDetail,
  ListConversationsAdminInput,
  ListMyConversationsInput,
  ListPromptVersionsInput,
  MenuIntentInput,
  MenuIntentResult,
  PromptVersionRow,
  PromptVersionsResult,
  ReindexKnowledgeInput,
  ReindexResult,
  RetentionPurgeDetail,
  RetrievedChunk,
  RollbackPromptVersionInput,
  SendMessageInput,
  StartConversationInput,
  StartConversationResult,
  Transcript,
} from "./types";

export type {
  AnthropicProviderConfig,
  LLMEvent,
  LLMMessage,
  LLMProvider,
  LLMStreamOptions,
} from "./llm";

/** Full-text retrieval over `knowledge_chunks` (`ts_rank`, top-8, A-304). */
export interface KnowledgeRetriever {
  retrieve(query: string, limit?: number): Promise<RetrievedChunk[]>;
}

/** Daily cap gate (D-708): user first, then platform; counts are incremented before the LLM call. */
export interface ChatCapGuard {
  caps(): Promise<ChatCaps>;
  check(userId: string, day: string): Promise<CapCheck>;
  /** Increment inside the request; `decrement` when the provider fails before the first token. */
  increment(userId: string, day: string, tx: TxCtx): Promise<void>;
  decrement(userId: string, day: string, tx: TxCtx): Promise<void>;
}

export interface ChatService {
  /** API-CHAT-06 `startConversation` — snapshot `ai_model`, active prompt version, `purge_after=today+12mo`; `A: chat_started`. */
  startConversation(
    ctx: RequestContext,
    input: StartConversationInput,
  ): Promise<StartConversationResult>;

  /** API-CHAT-07 `menuIntent` — `modules/chat/menus.ts`, no LLM; `contact` resolves to escalation. */
  menuIntent(ctx: RequestContext, input: MenuIntentInput): Promise<MenuIntentResult>;

  /**
   * API-CHAT-08 / docs/06 §3.2: pre-flight (rate class `chat` → caps → ownership → retrieval),
   * then `LLMProvider.stream()` with the active system prompt, `max_tokens 600`, 20 s timeout and
   * the `capture_lead` tool. Yields the SSE events in contract order; `fallback(limit)` alone when
   * a cap is hit (+ `N: chat.cap_reached` once per day); persists `chat_messages` after close.
   */
  sendMessage(
    ctx: RequestContext,
    input: SendMessageInput,
    provider: LLMProvider,
  ): AsyncIterable<ChatSseEvent>;

  /** API-CHAT-09 `escalateConversation` — `QueriesService.createFromEscalation`; `A: chat_escalated`. */
  escalateConversation(
    ctx: RequestContext,
    input: EscalateConversationInput,
  ): Promise<EscalateConversationResult>;

  /** API-CHAT-15 `confirmLeadCapture` — `LeadsService.createFromChatbot`; `A: chat_lead_captured`. */
  confirmLeadCapture(
    ctx: RequestContext,
    input: ConfirmLeadCaptureInput,
  ): Promise<{ leadId: string }>;

  /** API-CHAT-10 `endConversation`. */
  endConversation(ctx: RequestContext, input: EndConversationInput): Promise<void>;

  /** API-CHAT-10 `listMyConversations`. */
  listMyConversations(
    ctx: RequestContext,
    input: ListMyConversationsInput,
  ): Promise<ListResult<ConversationSummary>>;

  /** API-CHAT-11 `listConversationsAdmin` — `chat.transcripts.read`. */
  listConversationsAdmin(
    ctx: RequestContext,
    input: ListConversationsAdminInput,
  ): Promise<ListResult<ConversationSummary>>;

  /** API-CHAT-11 `getTranscript`. */
  getTranscript(ctx: RequestContext, input: GetTranscriptInput): Promise<Transcript>;

  /** API-CHAT-12 `listPromptVersions` — `chat.prompts.write`. */
  listPromptVersions(
    ctx: RequestContext,
    input: ListPromptVersionsInput,
  ): Promise<PromptVersionsResult>;

  /** API-CHAT-12 `createPromptVersion` — audited. */
  createPromptVersion(
    ctx: RequestContext,
    input: CreatePromptVersionInput,
  ): Promise<PromptVersionRow>;

  /** API-CHAT-12 `activatePromptVersion` — single active row; audited. */
  activatePromptVersion(
    ctx: RequestContext,
    input: ActivatePromptVersionInput,
  ): Promise<PromptVersionsResult>;

  /** API-CHAT-12 rollback — re-activates the previously active version of `name`; `STATE_INVALID` when none. */
  rollbackPromptVersion(
    ctx: RequestContext,
    input: RollbackPromptVersionInput,
  ): Promise<PromptVersionsResult>;

  /** API-CHAT-13 `reindexKnowledge` — rebuilds `knowledge_chunks` (also run by cron and on publish). */
  reindexKnowledge(ctx: RequestContext, input: ReindexKnowledgeInput): Promise<ReindexResult>;

  /** Cron `daily/knowledge.reindex`. */
  runKnowledgeReindexJob(job: JobContext): Promise<JobOutcome<KnowledgeReindexDetail>>;

  /** Cron `daily/retention.purge`: delete `conversations`/`chat_messages` with `purge_after < today` (D-1503). */
  runRetentionPurgeJob(job: JobContext): Promise<JobOutcome<RetentionPurgeDetail>>;
}
