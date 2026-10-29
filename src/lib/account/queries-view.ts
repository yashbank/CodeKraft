/**
 * View-model mapper for the customer Queries list screen (SCR-ACC-05 list) -- `modules/queries`'s
 * `QueryRow` -> `components/account/types.ts`'s `QuerySummary`. Kept out of the page and out of
 * the screen component, per the `purchases-view.ts` convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `preview` (the one-line snippet under the subject) is always the subject itself --
 *    `listMyQueries` returns query rows only, no joined last-message body, so there is no separate
 *    snippet text to show without an extra per-row message join this pass doesn't add.
 *  - `messages` is always `[]` -- the list screen never reads it (only a thread-detail screen
 *    would), and there is no thread-detail page in this pass to justify fetching every row's
 *    thread up front.
 *  - `unread` is always `false` -- `QueryRow.unreadForCaller` has no backing read-tracking column
 *    on `queries` (see `modules/queries/service.ts`'s `toQueryRow`), so it's never fabricated true.
 */
import { toPlainText } from "@/modules/content/render";
import type { QuerySummary } from "@/components/account/types";
import type { QueryRow, QueryThread } from "@/modules/queries/types";

export function mapQueryRowToSummary(q: QueryRow): QuerySummary {
  return {
    id: q.queryId,
    subject: q.subject,
    preview: q.subject,
    status: q.status,
    source: q.source,
    relatedLabel: q.orderNo ?? undefined,
    relatedHref: undefined,
    lastActivityAt: q.lastMessageAt,
    unread: q.unreadForCaller,
    messages: [],
  };
}

/** `getMyQuery` -> thread-detail `QuerySummary` (BUG-007) -- real messages, unlike the list mapper. */
export function mapQueryThreadToSummary(t: QueryThread): QuerySummary {
  const base = mapQueryRowToSummary(t.query);
  const lastMessage = t.messages.at(-1);
  return {
    ...base,
    preview: lastMessage ? toPlainText(lastMessage.bodyJson as never) : base.preview,
    messages: t.messages.map((m) => ({
      id: m.messageId,
      author: m.authorKind,
      authorName: m.authorKind === "admin" ? (m.author?.name ?? undefined) : undefined,
      body: toPlainText(m.bodyJson as never),
      at: m.createdAt,
      attachments: m.attachments.length > 0 ? m.attachments : undefined,
    })),
  };
}
