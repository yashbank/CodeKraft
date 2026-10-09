"use server";

/**
 * `chat` Server Actions (docs/06 §2.9 API-CHAT-12/13; PHASE-06). Every export uses `defineAction`
 * (SA-07).
 */
import {
  activatePromptVersionSchema,
  confirmLeadCaptureSchema,
  createPromptVersionSchema,
  endConversationSchema,
  escalateConversationSchema,
  menuIntentSchema,
  reindexKnowledgeSchema,
  rollbackPromptVersionSchema,
  startConversationSchema,
} from "./types";
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { chatService } from "./service";

export const seedDefaultPromptVersionAction = defineAction({
  name: "API-CHAT-12 prompt_version.seed_default",
  input: z.strictObject({}),
  permission: "chat.prompts.write",
  handler: (_input, ctx) => chatService.seedDefaultPromptVersion(ctx),
});

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

export const purgeConversationAction = defineAction({
  name: "API-CHAT admin.conversation.purge",
  input: endConversationSchema,
  permission: "chat.prompts.write",
  handler: (input, ctx) => chatService.purgeConversation(ctx, input),
});

export const dryRunAction = defineAction({
  name: "API-CHAT admin.dryRun",
  input: z.object({ message: z.string().trim().min(1).max(2000) }).strict(),
  permission: "chat.prompts.write",
  handler: (input, ctx) => chatService.dryRun(ctx, input),
});

// ---------------------------------------------------------------------------------------------
// Customer-facing actions (`chat.use`) — the admin-only actions above predate P7.
// ---------------------------------------------------------------------------------------------

export const startConversationAction = defineAction({
  name: "API-CHAT-06 conversation.start",
  input: startConversationSchema,
  permission: "chat.use",
  handler: (input, ctx) => chatService.startConversation(ctx, input),
});

export const menuIntentAction = defineAction({
  name: "API-CHAT-07 conversation.menu_intent",
  input: menuIntentSchema,
  permission: "chat.use",
  handler: (input, ctx) => chatService.menuIntent(ctx, input),
});

export const escalateConversationAction = defineAction({
  name: "API-CHAT-09 conversation.escalate",
  input: escalateConversationSchema,
  permission: "chat.use",
  handler: (input, ctx) => chatService.escalateConversation(ctx, input),
});

export const endConversationAction = defineAction({
  name: "API-CHAT-10 conversation.end",
  input: endConversationSchema,
  permission: "chat.use",
  handler: (input, ctx) => chatService.endConversation(ctx, input),
});

export const confirmLeadCaptureAction = defineAction({
  name: "API-CHAT-15 lead.confirm",
  input: confirmLeadCaptureSchema,
  permission: "chat.use",
  handler: (input, ctx) => chatService.confirmLeadCapture(ctx, input),
});
