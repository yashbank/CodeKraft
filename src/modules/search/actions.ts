"use server";

/**
 * Search Server Actions — docs/06 API-CHAT-13, PHASE-03 P3.13.
 * Wrapped in defineAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import { reindexKnowledgeSchema } from "@/modules/chat/types";
import { searchService } from "./service";

export const reindexKnowledgeAction = defineAction({
  name: "API-CHAT-13 chat.reindexKnowledge",
  input: reindexKnowledgeSchema,
  permission: "chat.prompts.write",
  handler: (input) => searchService.reindex(input.sourceType),
});
