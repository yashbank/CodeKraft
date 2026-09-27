import { QueriesScreen } from "@/components/account/QueriesScreen";
import { mapConversationToTranscript } from "@/lib/account/chat-view";
import { mapQueryRowToSummary } from "@/lib/account/queries-view";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { listMyConversationsQuery } from "@/modules/chat/queries";
import { listMyQueriesQuery } from "@/modules/queries/queries";

export const dynamic = "force-dynamic";

export default async function QueriesPage() {
  const ctx = await getSiteRequestContext();

  const [queriesResult, conversationsResult] = await Promise.all([
    listMyQueriesQuery({ limit: 100 }, ctx),
    listMyConversationsQuery({ limit: 25 }, ctx),
  ]);

  const queries = queriesResult.ok ? queriesResult.data.items.map(mapQueryRowToSummary) : [];
  const transcripts = conversationsResult.ok
    ? conversationsResult.data.items.map(mapConversationToTranscript)
    : [];

  return (
    <QueriesScreen
      queries={queries}
      transcripts={transcripts}
      now={new Date().toISOString()}
      links={{
        query: (id: string) => `/account/queries/${id}`,
        chat: "/account/chat",
        transcript: (id: string) => `/account/chat/${id}`,
      }}
    />
  );
}
