"use server";

/**
 * `chat` Server Actions (docs/06 §2.9 API-CHAT-12/13; PHASE-06). Every export uses `defineAction`
 * (SA-07).
 */
import {
  activatePromptVersionSchema,
  createPromptVersionSchema,
  reindexKnowledgeSchema,
  rollbackPromptVersionSchema,
} from "./types";
import { defineAction } from "@/lib/actions/envelope";
import { chatService } from "./service";

export const createPromptVersionAction = defineAction({
  name: "API-CHAT-12 prompt_version.create",
  input: createPromptVersionSchema,
  permission: "chat.prompts.write",
  handler: (input, ctx) => chatService.createPromptVersion(ctx, input),
});

export const activatePromptVersionAction = defineAction({
  name: "API-CHAT-12 prompt_version.activate",
  input: activatePromptVersionSchema,
  permission: "chat.prompts.write",
  handler: (input, ctx) => chatService.activatePromptVersion(ctx, input),
});

export const rollbackPromptVersionAction = defineAction({
  name: "API-CHAT-12 prompt_version.rollback",
  input: rollbackPromptVersionSchema,
  permission: "chat.prompts.write",
  handler: (input, ctx) => chatService.rollbackPromptVersion(ctx, input),
});

export const reindexKnowledgeAction = defineAction({
  name: "API-CHAT-13 knowledge.reindex",
  input: reindexKnowledgeSchema,
  permission: "chat.prompts.write",
  handler: (input, ctx) => chatService.reindexKnowledge(ctx, input),
});
