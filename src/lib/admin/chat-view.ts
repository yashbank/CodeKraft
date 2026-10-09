/**
 * View-model mappers: `modules/chat` shapes -> the `ChatbotMonitor` admin component's prop shapes
 * (`components/admin/types`). Kept out of the page component per the phase convention.
 *
 * Known gaps vs. a fully-populated screen -- see the phase report:
 *  - `usage.estimatedCostInr` and `usage.fallbackRate` are always `0`: no per-model pricing config
 *    and no fallback-hit flag are stored anywhere to compute them from (the component shows an
 *    explicit "not tracked" note next to both instead of treating the zero as a real measurement).
 *  - `usage.models` counts CONVERSATIONS per model (each conversation snapshots one model at
 *    start), not raw per-message counts -- there's no per-message model column.
 *  - `usage.providerDownSince` is always omitted: there's no provider health-check state stored.
 *  - conversation `promptVersion` falls back to a `v?` placeholder when the conversation's
 *    `promptVersionId` doesn't match any currently-listed prompt version (e.g. it was deleted).
 *  - prompt version `notes` is always `""`: `prompt_versions` has no notes column.
 */
import type {
  ConversationSummary,
  PromptVersionRow as ModulePromptVersionRow,
  Transcript,
} from "@/modules/chat/types";
import type { ChatUsageOverview } from "@/modules/chat/admin-usage";
import type {
  ChatbotMonitorData,
  ConversationRow,
  PromptVersionRow,
  TranscriptTurn,
} from "@/components/admin/types";

type AdminConversationSummary = ConversationSummary & {
  customerEmail: string | null;
  model: string;
  promptVersionId: string;
  totalTokens: number;
};

export function mapConversationRow(
  row: AdminConversationSummary,
  promptVersionLabelById: Map<string, string>,
): ConversationRow {
  return {
    id: row.conversationId,
    startedAt: row.startedAt,
    ...(row.customerEmail ? { customer: row.customerEmail } : {}),
    turns: row.messageCount,
    tokens: row.totalTokens,
    outcomes: row.escalatedQueryId ? ["escalated"] : [],
    model: row.model,
    promptVersion: promptVersionLabelById.get(row.promptVersionId) ?? "v?",
  };
}

export function mapTranscript(t: Transcript): { id: string; turns: TranscriptTurn[] } {
  return {
    id: t.conversation.conversationId,
    turns: t.messages
      .slice()
      .reverse()
      .map((m) => ({
        role: m.role,
        text: m.content,
        ...(m.retrievedChunks.length > 0 ? { sources: m.retrievedChunks.map((c) => c.title) } : {}),
        ...(m.role === "assistant" ? { tokens: m.tokensIn + m.tokensOut } : {}),
      })),
  };
}

export function mapPromptVersionRow(p: ModulePromptVersionRow): PromptVersionRow {
  return {
    promptVersionId: p.promptVersionId,
    version: `v${p.version}`,
    name: p.name,
    active: p.isActive,
    createdBy: p.createdBy?.name ?? "Unknown",
    createdAt: p.createdAt,
    notes: "",
    body: p.systemPrompt,
  };
}

export function mapUsage(overview: ChatUsageOverview): ChatbotMonitorData["usage"] {
  return {
    today: overview.today,
    cap: overview.cap,
    usersAtCap: overview.usersAtCap,
    perUserCap: overview.perUserCap,
    monthMessages: overview.monthMessages,
    estimatedCostInr: 0,
    fallbackRate: 0,
    escalationRate: overview.escalationRate,
    daily: overview.daily,
    topUsers: overview.topUsers,
    models: overview.models,
  };
}
