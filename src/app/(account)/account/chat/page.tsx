import { ChatScreen } from "@/components/account/ChatScreen";
import {
  chatMenu,
  chatMessages,
  chatTranscripts,
} from "@/app/dev/screens/_fixtures/account";
import { getSession } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await getSession();
  const firstName = session?.user.name?.split(" ")[0] || "Customer";

  return (
    <ChatScreen
      firstName={firstName}
      messages={chatMessages}
      transcripts={chatTranscripts}
      menu={chatMenu}
      messagesLeft={20}
      links={{
        queries: "/account/queries",
      }}
    />
  );
}
