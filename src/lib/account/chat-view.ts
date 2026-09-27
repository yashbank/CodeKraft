/**
 * View-model mappers for the customer Chat screen (SCR-ACC-06) -- `modules/chat`'s
 * `ConversationSummary` / `MenuNode` / `MenuMessage` -> `components/account/types.ts`'s
 * `ChatTranscript` / `ChatMessage`. Kept out of the page and out of the screen component, per the
 * `purchases-view.ts` convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `resolveMenuIntent` (`modules/chat/menus.ts`) only ever returns plain `content` text plus
 *    link `actions` -- its one `card` case (`order_status`) has no progress `steps`, which the
 *    component's rich `ChatCard` "order" variant requires. Rather than fabricate steps, quick
 *    replies are rendered as plain text with the real link(s) attached as `citations` (the
 *    component's only other slot for a labelled link), not as a `ChatCard`.
 */
import type { ChatMessage, ChatTranscript } from "@/components/account/types";
import type { ConversationSummary, MenuMessage, MenuNode } from "@/modules/chat/types";

export function mapConversationToTranscript(c: ConversationSummary): ChatTranscript {
  return {
    id: c.conversationId,
    startedAt: c.startedAt,
    preview: c.lastMessagePreview ?? "(no messages)",
    escalated: c.escalatedQueryId !== null,
  };
}

export function mapMenuNodesToChips(nodes: MenuNode[]): string[] {
  return nodes.map((n) => n.label);
}

/** Root menu greeting shown when a conversation starts (mirrors the fixture-era canned opener). */
export function buildGreeting(firstName: string, menu: MenuNode[]): ChatMessage[] {
  const now = new Date().toISOString();
  return [
    {
      id: "greeting",
      role: "assistant",
      text: `Hi ${firstName}. I can check your orders, downloads and renewals, or answer questions about our products and services. What do you need?`,
      at: now,
    },
    { id: "greeting-menu", role: "menu", chips: mapMenuNodesToChips(menu), at: now },
  ];
}

/** `resolveMenuIntent`'s response -> chat bubbles (see the file-level note on the `card` gap). */
export function mapMenuMessagesToChat(messages: MenuMessage[]): ChatMessage[] {
  const now = new Date().toISOString();
  return messages.map((m, i) => {
    const links = m.actions.flatMap((a) => ("href" in a ? [{ label: a.label, href: a.href }] : []));
    return {
      id: `menu-${Date.now()}-${i}`,
      role: "assistant",
      text: m.content,
      citations: links.length > 0 ? links : undefined,
      at: now,
    };
  });
}
