/**
 * Queries service contract — docs/06 §2.9 API-CHAT-01..05, API-CHAT-14, §3.3 `queries.auto_close`,
 * §5.6 (escalation), BR-09, D-702, D-1002, FR-LEAD-09. Implementation in P6.
 */
import type { Context, RequestContext } from "@/lib/authz/context";
import type { TxCtx } from "@/lib/db";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import type { ListResult } from "@/modules/_shared/zod";
import type {
  AssignQueryInput,
  CloseQueryInput,
  CreateQueryAdminInput,
  CreateQueryFromEscalationInput,
  CreateQueryInput,
  GetMyQueryInput,
  GetQueryAdminInput,
  ListMyQueriesInput,
  ListQueriesAdminInput,
  QueriesAutoCloseDetail,
  QueryCreateResult,
  QueryRow,
  QueryThread,
  ReopenQueryInput,
  ReplyToQueryInput,
  ReplyToQueryResult,
} from "./types";

export interface QueriesService {
  /**
   * API-CHAT-01 `createQuery` — customer (`support.self`) or visitor with Turnstile. Writes
   * `queries(status='open')` + first `query_messages(author_kind='customer')`; `N: query.new` to
   * admins; `A: inquiry_submitted` for the visitor form. `refundRequest=true` returns the existing
   * open refund thread for the order (`existing=true`) instead of creating another (BR-09);
   * `STATE_INVALID` for a refund request on a non-paid order.
   */
  createQuery(ctx: Context, input: CreateQueryInput): Promise<QueryCreateResult>;

  /** API-CHAT-14 `createQueryAdmin` — `queries.reply`; `N: query.new` to the customer. */
  createQueryAdmin(ctx: RequestContext, input: CreateQueryAdminInput): Promise<QueryCreateResult>;

  /**
   * API-CHAT-09 back-end (docs/06 §5.6 step 3): `queries(source='chatbot', conversation_id)` with
   * a system message holding the transcript excerpt, inside the chat module's transaction.
   */
  createFromEscalation(
    input: CreateQueryFromEscalationInput,
    tx: TxCtx,
  ): Promise<QueryCreateResult>;

  /** API-CHAT-02 `listMyQueries` — own rows only. */
  listMyQueries(ctx: RequestContext, input: ListMyQueriesInput): Promise<ListResult<QueryRow>>;

  /** API-CHAT-02 `getMyQuery` — `NOT_FOUND` when not the caller's. */
  getMyQuery(ctx: RequestContext, input: GetMyQueryInput): Promise<QueryThread>;

  /**
   * API-CHAT-03 `replyToQuery` — customer reply reopens `waiting_customer` → `open` and
   * `N: query.customer_replied` to assignee/admins; admin reply → `N: query.replied` +
   * `E: query-reply` to the customer. A customer may only `setStatus='resolved'` on their own thread.
   */
  replyToQuery(ctx: RequestContext, input: ReplyToQueryInput): Promise<ReplyToQueryResult>;

  /** API-CHAT-04 `listQueriesAdmin` — `queries.read`. */
  listQueriesAdmin(
    ctx: RequestContext,
    input: ListQueriesAdminInput,
  ): Promise<ListResult<QueryRow>>;

  /** API-CHAT-04 `getQueryAdmin` — thread + customer card + linked order + originating transcript. */
  getQueryAdmin(ctx: RequestContext, input: GetQueryAdminInput): Promise<QueryThread>;

  /** API-CHAT-05 `assignQuery` — `queries.reply`. */
  assignQuery(ctx: RequestContext, input: AssignQueryInput): Promise<QueryRow>;

  /** API-CHAT-05 `closeQuery` — `queries.close`; `E: query-closed`. */
  closeQuery(ctx: RequestContext, input: CloseQueryInput): Promise<QueryRow>;

  /** API-CHAT-05 `reopenQuery` — `queries.close`. */
  reopenQuery(ctx: RequestContext, input: ReopenQueryInput): Promise<QueryRow>;

  /** Cron `daily/queries.auto_close`: `waiting_customer` with no customer reply for 7 d → `closed`; `E: query-closed`. */
  runAutoCloseJob(job: JobContext): Promise<JobOutcome<QueriesAutoCloseDetail>>;
}
