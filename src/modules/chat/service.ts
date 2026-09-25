/**
 * `chat` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P6; the signatures are
 * the frozen `ChatService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { ChatService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "chat.<method> not implemented (P6)")`. */
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
    createPromptVersion: "async",
    activatePromptVersion: "async",
    rollbackPromptVersion: "async",
    reindexKnowledge: "async",
    runKnowledgeReindexJob: "async",
    runRetentionPurgeJob: "async",
  });
}
