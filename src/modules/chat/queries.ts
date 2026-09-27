"use server";

/**
 * `chat` read-only queries (docs/06 §2.9 API-CHAT-11/12; PHASE-06). Uses `defineAction` — reads
 * that never mutate.
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import {
  getTranscriptSchema,
  listConversationsAdminSchema,
  listMyConversationsSchema,
  listPromptVersionsSchema,
} from "./types";
import { getDb } from "@/lib/db";
import { chatService } from "./service";
import { getChatUsageOverview, getKnowledgeIndexStatus } from "./admin-usage";

export const listConversationsAdminQuery = defineAction({
  name: "API-CHAT-11 conversation.list_admin",
  input: listConversationsAdminSchema,
  permission: "chat.transcripts.read",
  handler: (input, ctx) => chatService.listConversationsAdmin(ctx, input),
});

export const getTranscriptQuery = defineAction({
  name: "API-CHAT-11 conversation.transcript",
  input: getTranscriptSchema,
  permission: "chat.transcripts.read",
  handler: (input, ctx) => chatService.getTranscript(ctx, input),
});

export const listPromptVersionsQuery = defineAction({
  name: "API-CHAT-12 prompt_version.list",
  input: listPromptVersionsSchema,
  permission: "chat.prompts.write",
  handler: (input, ctx) => chatService.listPromptVersions(ctx, input),
});

export const getChatUsageOverviewQuery = defineAction({
  name: "chat.usage_overview",
  input: z.strictObject({}),
  permission: "chat.transcripts.read",
  handler: async (_input, ctx) => getChatUsageOverview(ctx, getDb()),
});

export const getKnowledgeIndexStatusQuery = defineAction({
  name: "chat.knowledge_index_status",
  input: z.strictObject({}),
  permission: "chat.prompts.write",
  handler: async (_input, ctx) => getKnowledgeIndexStatus(ctx, getDb()),
});

/** API-CHAT-10 `listMyConversations` — `chat.use`, own rows only (service filters by `ctx.userId`). */
export const listMyConversationsQuery = defineAction({
  name: "API-CHAT-10 conversation.list_mine",
  input: listMyConversationsSchema,
  permission: "chat.use",
  handler: (input, ctx) => chatService.listMyConversations(ctx, input),
});
