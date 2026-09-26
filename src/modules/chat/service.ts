import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { type TxCtx, getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { users } from "../../../drizzle/schema/auth";
import {
  type Conversation,
  chatMessages,
  conversations,
  promptVersions,
} from "../../../drizzle/schema/chat";
import { queries } from "../../../drizzle/schema/queries";
import { leadsService } from "@/modules/leads/service";
import { notificationsService } from "@/modules/notifications/service";
import { queriesService } from "@/modules/queries/service";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import type { ListResult } from "@/modules/_shared/zod";
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

export class DefaultChatService implements ChatService {
  private _db?: any;
  constructor(db?: any) {
    this._db = db;
  }
  private get db(): any {
    return this._db ?? getDb();
  }

  async startConversation(
    ctx: RequestContext,
    input: StartConversationInput,
  ): Promise<StartConversationResult> {
    if (!ctx.userId) {
      throw new AppError("UNAUTHORIZED", "Authentication required to use AI chat");
    }

    const userRow = await this.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    if (!userRow[0] || !userRow[0].emailVerified) {
      throw new AppError("EMAIL_UNVERIFIED", "Please verify your email before using chat");
    }

    // Active prompt version
    let activePrompt = await this.db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.isActive, true))
      .limit(1);

    if (activePrompt.length === 0) {
      // Seed initial default prompt version if none exists
      const [newVersion] = await this.db
        .insert(promptVersions)
        .values({
          name: "Default Assistant Prompt",
          systemPrompt:
            "You are CodeKraft Assistant, an AI assistant for CodeKraft software solutions.",
          version: 1,
          isActive: true,
          createdBy: ctx.userId,
        })
        .returning();
      activePrompt = [newVersion];
    }

    const now = new Date();
    const purgeDate = new Date(now);
    purgeDate.setFullYear(purgeDate.getFullYear() + 1);
    const purgeAfter = purgeDate.toISOString().slice(0, 10);

    const [conv] = await this.db
      .insert(conversations)
      .values({
        userId: ctx.userId,
        model: "claude-3-5-sonnet-20241022",
        promptVersionId: activePrompt[0].id,
        purgeAfter,
      })
      .returning();

    const todayStr = now.toISOString().slice(0, 10);
    const capCheck = await chatCapGuard.check(ctx.userId, todayStr);

    return {
      conversationId: conv.id,
      menu: ROOT_MENU_NODES,
      usage: {
        userRemaining: capCheck.remainingUser ?? 30,
        platformRemaining: capCheck.remainingPlatform ?? 500,
      },
    };
  }

  async menuIntent(
    ctx: RequestContext,
    input: MenuIntentInput,
  ): Promise<MenuIntentResult> {
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
      if (capCheck.reason === "platform_cap") {
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

    const conv = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1);

    if (conv.length === 0 || conv[0].userId !== ctx.userId) {
      throw new AppError("NOT_FOUND", "Conversation not found");
    }

    // Record user message
    await this.db.insert(chatMessages).values({
      conversationId: input.conversationId,
      role: "user",
      content: input.content,
    });

    // Send meta event
    yield {
      event: "meta",
      data: {
        messageId: `msg-${Date.now()}`,
        usage: {
          userRemaining: (capCheck.remainingUser ?? 1) - 1,
          platformRemaining: (capCheck.remainingPlatform ?? 1) - 1,
        },
      },
    };

    const { systemPrompt, tools } = await buildChatPrompt([], conv[0].promptVersionId);

    let fullAssistantText = "";
    let tokensIn = 0;
    let tokensOut = 0;
    let stopReason: any = "end_turn";

    try {
      const stream = provider.stream(
        systemPrompt,
        [{ role: "user", content: input.content }],
        {
          model: conv[0].model,
          maxTokens: 600,
          timeoutMs: 20000,
          tools,
        },
      );

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

      yield {
        event: "done",
        data: {
          tokensIn,
          tokensOut,
          stopReason,
        },
      };
    } catch (err: any) {
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
    const conv = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1);

    if (conv.length === 0) {
      throw new AppError("NOT_FOUND", "Conversation not found");
    }

    if (conv[0].escalatedQueryId) {
      throw new AppError("STATE_INVALID", "Conversation already escalated");
    }

    // Get recent messages for excerpt
    const msgs = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conv[0].id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(10);

    const excerpt = msgs
      .reverse()
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const queryResult = await queriesService.createFromEscalation(
      {
        conversationId: conv[0].id,
        userId: ctx.userId,
        subject: input.subject ?? "Escalated from Chatbot",
        transcriptExcerpt: excerpt,
      },
      this.db,
    );

    await this.db
      .update(conversations)
      .set({
        escalatedQueryId: queryResult.queryId,
        endedAt: new Date(),
      })
      .where(eq(conversations.id, conv[0].id));

    return { queryId: queryResult.queryId };
  }

  async confirmLeadCapture(
    ctx: RequestContext,
    input: ConfirmLeadCaptureInput,
  ): Promise<{ leadId: string }> {
    const conv = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1);

    if (conv.length === 0) {
      throw new AppError("NOT_FOUND", "Conversation not found");
    }

    if (conv[0].endedAt) {
      throw new AppError("STATE_INVALID", "Conversation has ended");
    }

    const leadRes = await leadsService.createFromChatbot(
      {
        source: "chatbot",
        conversationId: input.conversationId,
        userId: ctx.userId,
        name: input.name,
        email: input.email,
        message: input.need,
      },
      this.db,
    );

    await this.db.insert(chatMessages).values({
      conversationId: input.conversationId,
      role: "system",
      content: `Lead captured for ${input.name} (${input.email})`,
    });

    return { leadId: leadRes.leadId };
  }

  async endConversation(
    ctx: RequestContext,
    input: EndConversationInput,
  ): Promise<void> {
    await this.db
      .update(conversations)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(conversations.id, input.conversationId),
          eq(conversations.userId, ctx.userId),
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

    const items: ConversationSummary[] = selected.map((c) => ({
      conversationId: c.id,
      startedAt: c.startedAt.toISOString(),
      endedAt: c.endedAt ? c.endedAt.toISOString() : null,
      escalatedQueryId: c.escalatedQueryId,
      messageCount: 1,
      lastMessagePreview: "Chat session",
    }));

    return {
      items,
      total: items.length,
      nextCursor: hasNext ? items[items.length - 1].conversationId : null,
    };
  }

  async listConversationsAdmin(
    ctx: RequestContext,
    input: ListConversationsAdminInput,
  ): Promise<ListResult<ConversationSummary & { userId: string }>> {
    const rows = await this.db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.startedAt))
      .limit((input.limit ?? 25) + 1);

    const hasNext = rows.length > (input.limit ?? 25);
    const selected = hasNext ? rows.slice(0, input.limit ?? 25) : rows;

    const items = selected.map((c) => ({
      conversationId: c.id,
      userId: c.userId,
      startedAt: c.startedAt.toISOString(),
      endedAt: c.endedAt ? c.endedAt.toISOString() : null,
      escalatedQueryId: c.escalatedQueryId,
      messageCount: 1,
      lastMessagePreview: "Chat session",
    }));

    return {
      items,
      total: items.length,
      nextCursor: hasNext ? items[items.length - 1].conversationId : null,
    };
  }

  async getTranscript(
    ctx: RequestContext,
    input: GetTranscriptInput,
  ): Promise<Transcript> {
    const conv = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1);

    if (conv.length === 0) {
      throw new AppError("NOT_FOUND", "Conversation not found");
    }

    const msgs = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conv[0].id))
      .orderBy(desc(chatMessages.createdAt));

    return {
      conversation: {
        conversationId: conv[0].id,
        userId: conv[0].userId,
        startedAt: conv[0].startedAt.toISOString(),
        endedAt: conv[0].endedAt ? conv[0].endedAt.toISOString() : null,
        escalatedQueryId: conv[0].escalatedQueryId,
        messageCount: msgs.length,
        lastMessagePreview: msgs[0]?.content ?? null,
        model: conv[0].model,
        promptVersionId: conv[0].promptVersionId,
        purgeAfter: conv[0].purgeAfter,
      },
      messages: msgs.map((m) => ({
        messageId: m.id,
        role: m.role as any,
        content: m.content,
        tokensIn: m.tokensIn,
        tokensOut: m.tokensOut,
        retrievedChunks: [],
        createdAt: m.createdAt.toISOString(),
      })),
      usage: {
        userToday: 1,
        userCap: 30,
        platformToday: 1,
        platformCap: 500,
      },
    };
  }

  async listPromptVersions(
    ctx: RequestContext,
    input: ListPromptVersionsInput,
  ): Promise<PromptVersionsResult> {
    const rows = await this.db
      .select()
      .from(promptVersions)
      .orderBy(desc(promptVersions.version));

    return {
      items: rows.map((p) => ({
        promptVersionId: p.id,
        name: p.name,
        version: p.version,
        isActive: p.isActive,
        systemPrompt: p.systemPrompt,
        createdAt: p.createdAt.toISOString(),
      })),
    };
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

    return {
      promptVersionId: row.id,
      name: row.name,
      version: row.version,
      isActive: row.isActive,
      systemPrompt: row.systemPrompt,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async activatePromptVersion(
    ctx: RequestContext,
    input: ActivatePromptVersionInput,
  ): Promise<PromptVersionRow> {
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

    if (!row) throw new AppError("NOT_FOUND", "Prompt version not found");

    return {
      promptVersionId: row.id,
      name: row.name,
      version: row.version,
      isActive: row.isActive,
      systemPrompt: row.systemPrompt,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async rollbackPromptVersion(
    ctx: RequestContext,
    input: RollbackPromptVersionInput,
  ): Promise<PromptVersionRow> {
    return await this.activatePromptVersion(ctx, { promptVersionId: input.targetPromptVersionId });
  }

  async reindexKnowledge(
    ctx: RequestContext,
    input: ReindexKnowledgeInput,
  ): Promise<ReindexResult> {
    return {
      indexed: 0,
      errors: 0,
    };
  }

  async runRetentionPurgeJob(
    job: JobContext,
  ): Promise<JobOutcome<RetentionPurgeDetail>> {
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
        conversationsPurged,
        messagesPurged: 0,
        jobId: job.jobId,
      },
    };
  }

  async runKnowledgeReindexJob(
    job: JobContext,
  ): Promise<JobOutcome<KnowledgeReindexDetail>> {
    return {
      status: "ok",
      detail: {
        reindexed: 0,
        errors: 0,
        jobId: job.jobId,
      },
    };
  }
}

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export function createChatService(db?: any): ChatService {
  return new DefaultChatService(db);
}

export const chatService = new DefaultChatService();

export function createNotImplementedChatService(): ChatService {
  return createNotImplemented<ChatService>("chat", "P6", {
    startConversation: "async",
    handleMenuIntent: "async",
    sendMessage: "async",
    escalateConversation: "async",
    confirmLeadCapture: "async",
    createPromptVersion: "async",
    activatePromptVersion: "async",
    rollbackPromptVersion: "async",
    reindexKnowledge: "async",
    streamTurn: "async",
    getMonitorData: "async",
  });
}
