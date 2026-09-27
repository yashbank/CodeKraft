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
import type { QuerySummary } from "@/components/account/types";
import type { QueryRow } from "@/modules/queries/types";

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
