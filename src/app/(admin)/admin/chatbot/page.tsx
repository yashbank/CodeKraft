import { ChatbotMonitor } from "@/components/admin/crm/ChatbotMonitor";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import {
  mapConversationRow,
  mapPromptVersionRow,
  mapTranscript,
  mapUsage,
} from "@/lib/admin/chat-view";
import { seedDefaultPromptVersionAction } from "@/modules/chat/actions";
import {
  getChatUsageOverviewQuery,
  getKnowledgeIndexStatusQuery,
  getTranscriptQuery,
  listConversationsAdminQuery,
  listPromptVersionsQuery,
} from "@/modules/chat/queries";

export const dynamic = "force-dynamic";

export default async function AdminChatbotPage() {
  const ctx = await getAdminRequestContext();
  let promptsResult = await listPromptVersionsQuery({}, ctx);
  if (promptsResult.ok && promptsResult.data.items.length === 0) {
    // Empty prompt index (before the first chat): seed the built-in default as v1 so the editor
    // is usable. Idempotent; a failure leaves the editor's explanation banner in place.
    const seeded = await seedDefaultPromptVersionAction({}, ctx);
    if (!seeded.ok) console.error("[admin/chatbot] seed default prompt failed", seeded.error);
    if (seeded.ok && seeded.data.seeded) promptsResult = await listPromptVersionsQuery({}, ctx);
  }
  const [conversationsResult, usageResult, indexResult] = await Promise.all([
    listConversationsAdminQuery({ limit: 50 }, ctx),
    getChatUsageOverviewQuery({}, ctx),
    getKnowledgeIndexStatusQuery({}, ctx),
  ]);

  const conversationRows = conversationsResult.ok ? conversationsResult.data.items : [];
  const prompts = promptsResult.ok ? promptsResult.data.items : [];
  const promptVersionLabelById = new Map(prompts.map((p) => [p.promptVersionId, `v${p.version}`]));

  const firstConversationId = conversationRows[0]?.conversationId;
  const transcriptResult = firstConversationId
    ? await getTranscriptQuery({ conversationId: firstConversationId }, ctx)
    : null;

  const data = {
    conversations: conversationRows.map((row) => mapConversationRow(row, promptVersionLabelById)),
    transcript:
      transcriptResult && transcriptResult.ok
        ? mapTranscript(transcriptResult.data)
        : { id: "", turns: [] },
    usage: usageResult.ok
      ? mapUsage(usageResult.data)
      : {
          today: 0,
          cap: 0,
          usersAtCap: 0,
          perUserCap: 0,
          monthMessages: 0,
          estimatedCostInr: 0,
          fallbackRate: 0,
          escalationRate: 0,
          daily: [],
          topUsers: [],
          models: [],
        },
    prompts: prompts.map(mapPromptVersionRow),
    lastIndexRun: indexResult.ok ? (indexResult.data.lastIndexRun ?? "") : "",
    indexChunks: indexResult.ok ? indexResult.data.chunks : 0,
  };

  return (
    <ChatbotMonitor
      data={data}
      settingsHref="/admin/settings"
      queriesHref="/admin/queries"
      leadsHref="/admin/leads"
    />
  );
}
