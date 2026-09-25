"use client";

import { ChatScreen } from "@/components/account/ChatScreen";
import { chatMenu, chatMessages, chatTranscripts } from "../../_fixtures/account";
import { DEV_LINKS } from "../_links";

export function Preview({ state }: { state: string }) {
  return (
    <ChatScreen
      firstName="Pravin"
      messages={
        state === "fallback"
          ? [
              ...chatMessages.slice(0, 2),
              {
                id: "u",
                role: "user",
                text: "What's the weather in Pune?",
                at: "2026-09-25T09:05:00Z",
              },
              {
                id: "f",
                role: "assistant",
                text: "I can't answer that from our site content. Try one of these:",
                at: "2026-09-25T09:05:02Z",
              },
              { id: "m2", role: "menu", chips: chatMenu, at: "2026-09-25T09:05:03Z" },
            ]
          : chatMessages
      }
      menu={chatMenu}
      transcripts={state === "empty-history" ? [] : chatTranscripts}
      messagesLeft={state === "cap" ? 0 : 12}
      capReached={state === "cap"}
      streaming={state === "streaming"}
      connectionLost={state === "connection-lost"}
      links={{ queries: DEV_LINKS.queries }}
    />
  );
}
