import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { type Db, getDb } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import { users } from "../../../drizzle/schema/auth";
import { assertEmailVerified } from "@/modules/auth/verified";
import {
  type Conversation,
  type PromptVersion,
  chatMessages,
  conversations,
  knowledgeChunks,
  promptVersions,
} from "../../../drizzle/schema/chat";
import { leadsService } from "@/modules/leads/service";
import { notificationsService } from "@/modules/notifications/service";
import { queriesService } from "@/modules/queries/service";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import type { ListResult } from "@/modules/_shared/zod";
import { settingsService } from "@/modules/settings/service";
import { chatCapGuard } from "./caps";
import type { ChatService, LLMEvent, LLMProvider } from "./contracts";
import { ROOT_MENU_NODES, resolveMenuIntent } from "./menus";
import { buildChatPrompt } from "./prompt";
import type {
  ActivatePromptVersionInput,
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
  RollbackPromptVersionInput,
  SendMessageInput,
  StartConversationInput,
  StartConversationResult,
  Transcript,
} from "./types";

/** Built-in prompt seeded as version 1 (first chat, or the admin editor on an empty index). */
const DEFAULT_PROMPT_NAME = "Default Assistant Prompt";
const DEFAULT_PROMPT_TEXT =
  "You are CodeKraft Assistant, an AI assistant for CodeKraft software solutions.";

export class DefaultChatService implements ChatService {
  private _db?: Db;
  constructor(db?: Db) {
    this._db = db;
  }
  private get db(): Db {
    return this._db ?? getDb();
  }

  async startConversation(
    ctx: RequestContext,
    _input: StartConversationInput,
  ): Promise<StartConversationResult> {
    if (!ctx.userId) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, "Authentication required to use AI chat");
    }

    // R9-13: no verified-email gate here -- new signups' chats must persist and reach admins.
    // Only the AI completion is withheld for unverified customers (see sendMessage).

    // Active prompt version
    let activePrompt = (
      await this.db.select().from(promptVersions).where(eq(promptVersions.isActive, true)).limit(1)
    )[0];

    if (!activePrompt) {
      // Seed initial default prompt version if none exists
      const [newVersion] = await this.db
        .insert(promptVersions)
        .values({
          name: DEFAULT_PROMPT_NAME,
          systemPrompt: DEFAULT_PROMPT_TEXT,
          version: 1,
          isActive: true,
          createdBy: ctx.userId,
        })
        .returning();
      if (!newVersion) throw new AppError(ErrorCode.INTERNAL, "Insert returned no row");
      activePrompt = newVersion;
    }

    const now = new Date();
    const purgeDate = new Date(now);
    purgeDate.setFullYear(purgeDate.getFullYear() + 1);
    const purgeAfter = purgeDate.toISOString().slice(0, 10);

    const [conv] = await this.db
      .insert(conversations)
      .values({
        userId: ctx.userId,
        model: (await settingsService.load()).aiModel,
        promptVersionId: activePrompt.id,
        purgeAfter,
      })
      .returning();
    if (!conv) throw new AppError(ErrorCode.INTERNAL, "Insert returned no row");

    const todayStr = now.toISOString().slice(0, 10);
    const capCheck = await chatCapGuard.check(ctx.userId, todayStr);

    return {
      conversationId: conv.id,
      menu: ROOT_MENU_NODES,
      usage: capCheck.usage,
    };
  }

  /** Best-effort admin alert: a notification failure must never break the customer's chat. */
  private async notifyAdminsChatStarted(
    userId: string,
    conversationId: string,
    firstMessage: string,
  ): Promise<void> {
    try {
      const [u] = await this.db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      await notificationsService.emit(
        "admins",
        "chat.new",
        {
          conversationId,
          customerName: u?.name || u?.email || "Customer",
          preview: firstMessage.slice(0, 140),
        },
        ["inapp"],
        this.db,
      );
    } catch (err) {
      getLogger().error({ err, conversationId }, "chat.new admin notification failed");
    }
  }

  /** R8-08: the chatbot (messages, menu intents, handoff) is locked until the email is verified. */
  async assertCanChat(ctx: RequestContext): Promise<void> {
    await assertEmailVerified(ctx, this.db, "Please verify your email before using chat");
  }

  private async canUseAi(ctx: RequestContext): Promise<boolean> {
    try {
      await this.assertCanChat(ctx);
      return true;
    } catch {
      return false;
    }
  }

  async menuIntent(ctx: RequestContext, input: MenuIntentInput): Promise<MenuIntentResult> {
    await this.assertCanChat(ctx);
    return await resolveMenuIntent(ctx, input);
  }

  async *sendMessage(
    ctx: RequestContext,
    input: SendMessageInput,
    provider: LLMProvider,
  ): AsyncIterable<ChatSseEvent> {
    const today = new Date().toISOString().slice(0, 10);
    const capCheck = await chatCapGuard.check(ctx.userId, today);

    if (!capCheck.allowed) {
      // Emit notification once per day if platform cap
      if (capCheck.exceeded === "platform") {
        await notificationsService.emit(
          "admins",
          "chat.cap_reached",
          { day: today },
          undefined,
          this.db,
          { onceKey: `chat.cap_reached:${today}` },
        );
      }

      yield {
        event: "fallback",
        data: {
          menu: ROOT_MENU_NODES,
          reason: "limit",
        },
      };
      yield {
        event: "done",
        data: {
          tokensIn: 0,
          tokensOut: 0,
          stopReason: "max_tokens",
        },
      };
      return;
    }

    // Increment caps before calling provider
    await chatCapGuard.increment(ctx.userId, today, this.db);

    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1);

    if (!conv || conv.userId !== ctx.userId) {
      throw new AppError(ErrorCode.NOT_FOUND, "Conversation not found");
    }

    const [prior] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conv.id), eq(chatMessages.role, "user")));

    // Record user message
    await this.db.insert(chatMessages).values({
      conversationId: input.conversationId,
      role: "user",
      content: input.content,
    });

    // R8-06: tell admins (in-app) when a customer starts a real chat -- once per conversation,
    // on the first user message (the page creates a conversation row on every visit).
    if ((prior?.n ?? 0) === 0) {
      await this.notifyAdminsChatStarted(ctx.userId, conv.id, input.content);
    }

    // R9-13: unverified customers are persisted + notified above but get no AI completion.
    if (!(await this.canUseAi(ctx))) {
      await chatCapGuard.decrement(ctx.userId, today, this.db);
      yield {
        event: "fallback",
        data: {
          menu: ROOT_MENU_NODES,
          reason: "unavailable",
          message:
            "Thanks, your message reached our team. Verify your email to chat with the assistant, or use Talk to a human and we will reply to you here.",
        },
      };
      yield { event: "done", data: { tokensIn: 0, tokensOut: 0, stopReason: "end_turn" } };
      return;
    }

    // Send meta event
    yield {
      event: "meta",
      data: {
        messageId: `msg-${Date.now()}`,
        usage: {
          userRemaining: capCheck.usage.userRemaining - 1,
          platformRemaining: capCheck.usage.platformRemaining - 1,
        },
      },
    };

    const { systemPrompt, tools } = await buildChatPrompt([], conv.promptVersionId);
    const { chatTimeoutMs } = await settingsService.load();

    let fullAssistantText = "";
    let tokensIn = 0;
    let tokensOut = 0;
    let stopReason: Extract<LLMEvent, { type: "done" }>["stopReason"] = "end_turn";

    try {
      const stream = provider.stream(systemPrompt, [{ role: "user", content: input.content }], {
        model: conv.model,
        maxTokens: 600,
        timeoutMs: chatTimeoutMs,
        tools,
      });

      for await (const chunk of stream) {
        if (chunk.type === "text") {
          fullAssistantText += chunk.text;
          yield {
            event: "delta",
            data: { text: chunk.text },
          };
        } else if (chunk.type === "tool" && chunk.name === "capture_lead") {
          // Emit lead_intent event (does NOT write to DB yet!)
          yield {
            event: "lead_intent",
            data: {
              name: (chunk.input.name as string) ?? undefined,
              email: (chunk.input.email as string) ?? undefined,
              need: (chunk.input.need as string) ?? input.content,
            },
          };
        } else if (chunk.type === "refusal") {
          yield {
            event: "fallback",
            data: {
              menu: ROOT_MENU_NODES,
              reason: "refusal",
            },
          };
        } else if (chunk.type === "done") {
          tokensIn = chunk.usage.inputTokens;
          tokensOut = chunk.usage.outputTokens;
          stopReason = chunk.stopReason;
        }
      }

      // Persist assistant message
      if (fullAssistantText.length > 0) {
        await this.db.insert(chatMessages).values({
          conversationId: input.conversationId,
          role: "assistant",
          content: fullAssistantText,
          tokensIn,
          tokensOut,
        });
      }

      if (stopReason === "timeout" || stopReason === "error") {
        yield {
          event: "fallback",
          data: {
            menu: ROOT_MENU_NODES,
            reason: stopReason === "timeout" ? "timeout" : "unavailable",
          },
        };
      }

      yield {
        event: "done",
        data: {
          tokensIn,
          tokensOut,
          stopReason,
        },
      };
    } catch {
      await chatCapGuard.decrement(ctx.userId, today, this.db);
      yield {
        event: "fallback",
        data: {
          menu: ROOT_MENU_NODES,
          reason: "unavailable",
        },
      };
      yield {
        event: "done",
        data: {
          tokensIn: 0,
          tokensOut: 0,
          stopReason: "error",
        },
      };
    }
  }

  async escalateConversation(
    ctx: RequestContext,
    input: EscalateConversationInput,
  ): Promise<EscalateConversationResult> {
    // R9-13: handoff to a human is open to unverified customers (replies arrive by notification).
    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.userId)))
      .limit(1);

    if (!conv) {
      throw new AppError(ErrorCode.NOT_FOUND, "Conversation not found");
    }

    if (conv.escalatedQueryId) {
      throw new AppError(ErrorCode.STATE_INVALID, "Conversation already escalated");
    }

    // Get recent messages for excerpt
    const msgs = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conv.id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(10);

    const excerpt = msgs
      .reverse()
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    // R8-05: the chat UI sends the customer's note as `summary` -- it used to be dropped, so every
    // handoff arrived as "Escalated from Chatbot" with no context. Use it as subject + preamble.
    const summary = input.summary?.trim();
    const subject =
      input.subject ??
      (summary && summary.length >= 3
        ? summary.length > 160
          ? `${summary.slice(0, 157)}...`
          : summary
        : "Escalated from Chatbot");

    const queryResult = await queriesService.createFromEscalation(
      {
        conversationId: conv.id,
        userId: ctx.userId,
        subject,
        transcriptExcerpt: summary ? `Customer note: ${summary}\n\n${excerpt}` : excerpt,
      },
      this.db,
    );

    await this.db
      .update(conversations)
      .set({
        escalatedQueryId: queryResult.queryId,
        endedAt: new Date(),
      })
      .where(eq(conversations.id, conv.id));

    return { queryId: queryResult.queryId };
  }

  async confirmLeadCapture(
    ctx: RequestContext,
    input: ConfirmLeadCaptureInput,
  ): Promise<{ leadId: string }> {
    await this.assertCanChat(ctx);
    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.userId)))
      .limit(1);

    if (!conv) {
      throw new AppError(ErrorCode.NOT_FOUND, "Conversation not found");
    }

    if (conv.endedAt) {
      throw new AppError(ErrorCode.STATE_INVALID, "Conversation has ended");
    }

    // name/email are optional on the card; fall back to the signed-in customer's own details.
    const [me] = await this.db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);
    if (!me) throw new AppError(ErrorCode.NOT_FOUND, "User not found");
    const name = input.name ?? me.name ?? me.email;
    const email = input.email ?? me.email;

    const leadRes = await leadsService.createFromChatbot(
      {
        source: "chatbot",
        conversationId: input.conversationId,
        userId: ctx.userId,
        name,
        email,
        message: input.need,
      },
      this.db,
    );

    await this.db.insert(chatMessages).values({
      conversationId: input.conversationId,
      role: "system",
      content: `Lead captured for ${name} (${email})`,
    });

    return { leadId: leadRes.leadId };
  }

  async endConversation(ctx: RequestContext, input: EndConversationInput): Promise<void> {
    await this.db
      .update(conversations)
      .set({ endedAt: new Date() })
      .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.userId)));
  }

  /** Real per-conversation message count / latest preview / token total (fixes a P2.8 stub that hardcoded `1` / "Chat session"). */
  private async statsForConversations(
    ids: string[],
  ): Promise<
    Map<string, { messageCount: number; lastMessagePreview: string | null; totalTokens: number }>
  > {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        conversationId: chatMessages.conversationId,
        messageCount: sql<number>`count(*)::int`,
        lastMessagePreview: sql<
          string | null
        >`(array_agg(${chatMessages.content} order by ${chatMessages.createdAt} desc))[1]`,
        totalTokens: sql<number>`coalesce(sum(${chatMessages.tokensIn} + ${chatMessages.tokensOut}), 0)::int`,
      })
      .from(chatMessages)
      .where(inArray(chatMessages.conversationId, ids))
      .groupBy(chatMessages.conversationId);
    return new Map(
      rows.map(
        (r: {
          conversationId: string;
          messageCount: number;
          lastMessagePreview: string | null;
          totalTokens: number;
        }) => [r.conversationId, r],
      ),
    );
  }

  async listMyConversations(
    ctx: RequestContext,
    input: ListMyConversationsInput,
  ): Promise<ListResult<ConversationSummary>> {
    const rows = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, ctx.userId))
      .orderBy(desc(conversations.startedAt))
      .limit((input.limit ?? 25) + 1);

    const hasNext = rows.length > (input.limit ?? 25);
    const selected = hasNext ? rows.slice(0, input.limit ?? 25) : rows;
    const stats = await this.statsForConversations(selected.map((c: Conversation) => c.id));

    const items: ConversationSummary[] = selected.map((c: Conversation) => ({
      conversationId: c.id,
      startedAt: c.startedAt.toISOString(),
      endedAt: c.endedAt ? c.endedAt.toISOString() : null,
      escalatedQueryId: c.escalatedQueryId,
      messageCount: stats.get(c.id)?.messageCount ?? 0,
      lastMessagePreview: stats.get(c.id)?.lastMessagePreview ?? null,
    }));

    return {
      items,
      total: items.length,
      nextCursor: hasNext ? (items.at(-1)?.conversationId ?? null) : null,
    };
  }

  async listConversationsAdmin(
    ctx: RequestContext,
    input: ListConversationsAdminInput,
  ): Promise<
    ListResult<
      ConversationSummary & {
        userId: string;
        customerEmail: string | null;
        model: string;
        promptVersionId: string;
        totalTokens: number;
      }
    >
  > {
    const rows = await this.db
      .select({ conversation: conversations, customerEmail: users.email })
      .from(conversations)
      .leftJoin(users, eq(conversations.userId, users.id))
      .orderBy(desc(conversations.startedAt))
      .limit((input.limit ?? 25) + 1);

    const hasNext = rows.length > (input.limit ?? 25);
    const selected = hasNext ? rows.slice(0, input.limit ?? 25) : rows;
    const stats = await this.statsForConversations(
      selected.map(
        (r: { conversation: Conversation; customerEmail: string | null }) => r.conversation.id,
      ),
    );

    const items = selected.map(
      ({
        conversation: c,
        customerEmail,
      }: {
        conversation: Conversation;
        customerEmail: string | null;
      }) => ({
        conversationId: c.id,
        userId: c.userId,
        customerEmail: customerEmail ?? null,
        startedAt: c.startedAt.toISOString(),
        endedAt: c.endedAt ? c.endedAt.toISOString() : null,
        escalatedQueryId: c.escalatedQueryId,
        messageCount: stats.get(c.id)?.messageCount ?? 0,
        lastMessagePreview: stats.get(c.id)?.lastMessagePreview ?? null,
        model: c.model,
        promptVersionId: c.promptVersionId,
        totalTokens: stats.get(c.id)?.totalTokens ?? 0,
      }),
    );

    return {
      items,
      total: items.length,
      nextCursor: hasNext ? (items.at(-1)?.conversationId ?? null) : null,
    };
  }

  async getTranscript(ctx: RequestContext, input: GetTranscriptInput): Promise<Transcript> {
    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1);

    if (!conv) {
      throw new AppError(ErrorCode.NOT_FOUND, "Conversation not found");
    }

    const msgs = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conv.id))
      .orderBy(desc(chatMessages.createdAt));

    const caps = await chatCapGuard.caps();
    return {
      conversation: {
        conversationId: conv.id,
        userId: conv.userId,
        startedAt: conv.startedAt.toISOString(),
        endedAt: conv.endedAt ? conv.endedAt.toISOString() : null,
        escalatedQueryId: conv.escalatedQueryId,
        messageCount: msgs.length,
        lastMessagePreview: msgs[0]?.content ?? null,
        model: conv.model,
        promptVersionId: conv.promptVersionId,
        purgeAfter: conv.purgeAfter,
      },
      messages: msgs.map((m) => ({
        messageId: m.id,
        role: m.role,
        content: m.content,
        tokensIn: m.tokensIn,
        tokensOut: m.tokensOut,
        retrievedChunks: [],
        createdAt: m.createdAt.toISOString(),
      })),
      usage: {
        userToday: 1,
        userCap: caps.userDaily,
        platformToday: 1,
        platformCap: caps.platformDaily,
      },
    };
  }

  async listPromptVersions(
    _ctx: RequestContext,
    _input: ListPromptVersionsInput,
  ): Promise<PromptVersionsResult> {
    const rows = await this.db
      .select({ prompt: promptVersions, creatorName: users.name })
      .from(promptVersions)
      .leftJoin(users, eq(promptVersions.createdBy, users.id))
      .orderBy(desc(promptVersions.version));

    return {
      items: rows.map(({ prompt: p, creatorName }) => ({
        promptVersionId: p.id,
        name: p.name,
        version: p.version,
        isActive: p.isActive,
        systemPrompt: p.systemPrompt,
        createdBy: p.createdBy ? { id: p.createdBy, name: creatorName } : null,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Seeds the built-in default prompt as version 1 (active) when the prompt table is empty, so the
   * admin prompt editor is usable before the first chat. A no-op once any version exists. The
   * partial unique index on `is_active` makes a concurrent second seed a no-op too.
   */
  async seedDefaultPromptVersion(ctx: RequestContext): Promise<{ seeded: boolean }> {
    const existing = await this.db.select({ id: promptVersions.id }).from(promptVersions).limit(1);
    if (existing.length > 0) return { seeded: false };

    const inserted = await this.db
      .insert(promptVersions)
      .values({
        name: DEFAULT_PROMPT_NAME,
        systemPrompt: DEFAULT_PROMPT_TEXT,
        version: 1,
        isActive: true,
        createdBy: ctx.userId,
      })
      .onConflictDoNothing()
      .returning({ id: promptVersions.id });
    return { seeded: inserted.length > 0 };
  }

  async createPromptVersion(
    ctx: RequestContext,
    input: CreatePromptVersionInput,
  ): Promise<PromptVersionRow> {
    const maxVer = await this.db
      .select({ max: sql<number>`COALESCE(MAX(${promptVersions.version}), 0)::int` })
      .from(promptVersions);

    const nextVer = (maxVer[0]?.max ?? 0) + 1;

    const [row] = await this.db
      .insert(promptVersions)
      .values({
        name: input.name,
        systemPrompt: input.systemPrompt,
        version: nextVer,
        isActive: false,
        createdBy: ctx.userId,
      })
      .returning();
    if (!row) throw new AppError(ErrorCode.INTERNAL, "Insert returned no row");

    return {
      promptVersionId: row.id,
      name: row.name,
      version: row.version,
      isActive: row.isActive,
      systemPrompt: row.systemPrompt,
      createdBy: row.createdBy ? { id: row.createdBy, name: null } : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async activatePromptVersion(
    ctx: RequestContext,
    input: ActivatePromptVersionInput,
  ): Promise<PromptVersionsResult> {
    // Single active version invariant: set all false first, then set one true
    await this.db
      .update(promptVersions)
      .set({ isActive: false })
      .where(eq(promptVersions.isActive, true));

    const [row] = await this.db
      .update(promptVersions)
      .set({ isActive: true })
      .where(eq(promptVersions.id, input.promptVersionId))
      .returning();

    if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Prompt version not found");

    return await this.listPromptVersions(ctx, {});
  }

  /**
   * "Previously active" (docs/04 §9) has no dedicated history table -- there is only the current
   * `is_active` flag -- so this uses the best available proxy: among the OTHER versions sharing
   * `name`, the highest-numbered one that isn't currently active. `STATE_INVALID` when there is
   * no other version to fall back to.
   */
  async rollbackPromptVersion(
    ctx: RequestContext,
    input: RollbackPromptVersionInput,
  ): Promise<PromptVersionsResult> {
    const rows = await this.db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.name, input.name))
      .orderBy(desc(promptVersions.version));

    const target = rows.find((r: PromptVersion) => !r.isActive);
    if (!target) {
      throw new AppError(ErrorCode.STATE_INVALID, "No previous version to roll back to");
    }

    return await this.activatePromptVersion(ctx, { promptVersionId: target.id });
  }

  /**
   * The real rebuild pipeline (re-deriving `knowledge_chunks` from published products / offerings
   * / services / FAQs / legal pages / case studies) is out of this phase's scope -- it touches
   * several content modules this phase doesn't own. This returns the current chunk count honestly
   * rather than fabricating a rebuild; the admin UI disables the "Rebuild" action and says so.
   */
  async reindexKnowledge(
    _ctx: RequestContext,
    _input: ReindexKnowledgeInput,
  ): Promise<ReindexResult> {
    const rows = await this.db.select({ id: knowledgeChunks.id }).from(knowledgeChunks);
    return { chunks: rows.length };
  }

  async purgeConversation(
    _ctx: RequestContext,
    input: { conversationId: string },
  ): Promise<{ purged: boolean }> {
    const id = input.conversationId;
    await this.db.delete(chatMessages).where(eq(chatMessages.conversationId, id));
    const gone = await this.db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning({ id: conversations.id });
    return { purged: gone.length > 0 };
  }

  async dryRun(_ctx: RequestContext, input: { message: string }): Promise<{ answer: string }> {
    const { systemPrompt } = await buildChatPrompt();
    // Lazy import: the provider factory pulls the Anthropic SDK; FakeProvider is used without a key.
    const { getLLMProvider } = await import("./providers");
    const { aiModel, chatTimeoutMs } = await settingsService.load();
    let answer = "";
    for await (const ev of getLLMProvider().stream(
      systemPrompt,
      [{ role: "user", content: input.message }],
      { model: aiModel, maxTokens: 600, timeoutMs: chatTimeoutMs },
    )) {
      if (ev.type === "text") answer += ev.text;
    }
    return { answer };
  }

  async runRetentionPurgeJob(job: JobContext): Promise<JobOutcome<RetentionPurgeDetail>> {
    const todayStr = job.now.toISOString().slice(0, 10);

    const expired = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(lt(conversations.purgeAfter, todayStr));

    let conversationsPurged = 0;
    if (expired.length > 0) {
      const ids = expired.map((e) => e.id);
      await this.db.delete(chatMessages).where(inArray(chatMessages.conversationId, ids));
      await this.db.delete(conversations).where(inArray(conversations.id, ids));
      conversationsPurged = ids.length;
    }

    return {
      status: "ok",
      detail: {
        conversations: conversationsPurged,
        messages: 0,
        conversationsPurged,
        messagesPurged: 0,
      },
    };
  }

  async runKnowledgeReindexJob(_job: JobContext): Promise<JobOutcome<KnowledgeReindexDetail>> {
    return {
      status: "ok",
      detail: {
        chunks: 0,
        bySource: {},
        reindexed: 0,
        errors: 0,
      },
    };
  }
}

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export function createChatService(db?: Db): ChatService {
  return new DefaultChatService(db);
}

export const chatService = new DefaultChatService();

export function createNotImplementedChatService(): ChatService {
  return createNotImplemented<ChatService>("chat", "P6", {
    startConversation: "async",
    menuIntent: "async",
    sendMessage: "sync",
    escalateConversation: "async",
    confirmLeadCapture: "async",
    endConversation: "async",
    listMyConversations: "async",
    listConversationsAdmin: "async",
    getTranscript: "async",
    listPromptVersions: "async",
    seedDefaultPromptVersion: "async",
    createPromptVersion: "async",
    activatePromptVersion: "async",
    rollbackPromptVersion: "async",
    reindexKnowledge: "async",
    purgeConversation: "async",
    dryRun: "async",
    runKnowledgeReindexJob: "async",
    runRetentionPurgeJob: "async",
  });
}
