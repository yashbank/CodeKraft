/** Custom quotes service contract (docs/06 §2.3 API-COM-09, API-COM-10). */
import type { TxCtx } from "@/lib/db";
import type { Context, RequestContext } from "@/lib/authz/context";
import type { ListResult } from "@/modules/_shared/zod";
import type { CreateOrderResult } from "@/modules/orders/types";
import type {
  AcceptCustomQuoteInput,
  CancelCustomQuoteInput,
  CreateCustomQuoteInput,
  CreateQuoteResult,
  CustomQuote,
  GetQuoteInput,
  ListQuotesInput,
  QuoteView,
  SendCustomQuoteInput,
} from "./types";

export interface QuotesService {
  /** API-COM-09 `createCustomQuote` — `draft`; returns the pay link. */
  createCustomQuote(
    ctx: RequestContext,
    input: CreateCustomQuoteInput,
    tx?: TxCtx,
  ): Promise<CreateQuoteResult>;
  /** API-COM-09 `sendCustomQuote` — `draft → sent`; `N: quote.sent`, `E: custom-quote`. */
  sendCustomQuote(
    ctx: RequestContext,
    input: SendCustomQuoteInput,
    tx?: TxCtx,
  ): Promise<{ quote: CustomQuote }>;
  /** API-COM-09 `cancelCustomQuote` — `STATE_INVALID` once `paid`. */
  cancelCustomQuote(
    ctx: RequestContext,
    input: CancelCustomQuoteInput,
    tx?: TxCtx,
  ): Promise<{ quote: CustomQuote }>;
  /** Admin list (companion query of API-COM-09). */
  listQuotes(ctx: RequestContext, input: ListQuotesInput): Promise<ListResult<CustomQuote>>;

  /**
   * API-COM-10 `getQuote` (query) — any session on `/quote/[token]`; read-only with
   * `canAccept=false` for a different account. `NOT_FOUND`, `ORDER_EXPIRED`.
   */
  getQuote(ctx: Context, input: GetQuoteInput): Promise<QuoteView>;
  /**
   * API-COM-10 `acceptCustomQuote` — `commerce.self`, session user must equal `customer_id`
   * (`FORBIDDEN`); `sent → accepted`, creates the order (coupons not applicable).
   */
  acceptCustomQuote(
    ctx: RequestContext,
    input: AcceptCustomQuoteInput,
    tx?: TxCtx,
  ): Promise<CreateOrderResult>;

  // -- internal --------------------------------------------------------------------------------

  /** Called by `orders.markPaid` for orders with `custom_quote_id`: `accepted → paid`. */
  markPaid(quoteId: string, tx: TxCtx): Promise<void>;
  /** Cron: `sent|accepted` past `expires_at` → `expired`. */
  expireQuotes(now: Date, tx?: TxCtx): Promise<{ expiredQuoteIds: string[] }>;
}
