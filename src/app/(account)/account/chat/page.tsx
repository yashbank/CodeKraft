import { ChatScreen } from "@/components/account/ChatScreen";
import { buildGreeting, mapConversationToTranscript } from "@/lib/account/chat-view";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { getSession } from "@/modules/auth/service";
import { startConversationAction } from "@/modules/chat/actions";
import { listMyConversationsQuery } from "@/modules/chat/queries";
import { ROOT_MENU_NODES } from "@/modules/chat/menus";
import type { MenuIntent } from "@/modules/chat/types";

export const dynamic = "force-dynamic";

const MENU_INTENTS: Partial<Record<string, MenuIntent>> = Object.fromEntries(
  ROOT_MENU_NODES.map((n) => [n.label, n.intent]),
);

export default async function ChatPage() {
  const session = await getSession();
  const firstName = session?.user.name?.split(" ")[0] || "Customer";

  const ctx = await getSiteRequestContext();
  const [started, conversationsResult] = await Promise.all([
    startConversationAction({}, ctx),
    listMyConversationsQuery({}, ctx),
  ]);

  const transcripts = conversationsResult.ok
    ? conversationsResult.data.items.map(mapConversationToTranscript)
    : [];

  if (!started.ok) {
    // `EMAIL_UNVERIFIED` is the only realistic failure here (an authenticated customer with an
    // unverified email) -- render the screen with no live conversation rather than a hard error;
    // ChatScreen degrades to its local-only fallback when `conversationId` is absent.
    return (
      <ChatScreen
        firstName={firstName}
        messages={[
          {
            id: "unverified",
            role: "assistant",
            text: "Please verify your email address to use the assistant.",
            at: new Date().toISOString(),
          },
        ]}
        menu={ROOT_MENU_NODES.map((n) => n.label)}
        menuIntents={MENU_INTENTS}
        transcripts={transcripts}
        messagesLeft={0}
        capReached
        links={{ queries: "/account/queries" }}
      />
    );
  }

  return (
    <ChatScreen
      firstName={firstName}
      messages={buildGreeting(firstName, started.data.menu)}
      menu={started.data.menu.map((n) => n.label)}
      menuIntents={MENU_INTENTS}
      conversationId={started.data.conversationId}
      transcripts={transcripts}
      messagesLeft={started.data.usage.userRemaining}
      links={{
        queries: "/account/queries",
      }}
    />
  );
}
