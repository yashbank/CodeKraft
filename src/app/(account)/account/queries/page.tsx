import { QueriesScreen } from "@/components/account/QueriesScreen";
import {
  chatTranscripts,
  queries,
} from "@/app/dev/screens/_fixtures/account";

export const dynamic = "force-dynamic";

export default function QueriesPage() {
  return (
    <QueriesScreen
      queries={queries}
      transcripts={chatTranscripts}
      now={new Date().toISOString()}
      links={{
        query: (id: string) => `/account/queries/${id}`,
        chat: "/account/chat",
        transcript: (id: string) => `/account/chat/${id}`,
      }}
    />
  );
}
