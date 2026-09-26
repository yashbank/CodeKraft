/**
 * Orders service contract (docs/06 §2.3 API-COM-01..07, API-COM-14; §5.1 sequence).
 *
 * Implemented in P3/P4 (`service.ts`). Actions parse with the schemas in `./types` first
 * (docs/06 §1.3), then assert the permission, then call these methods. Every mutation reached
 * from an admin session writes an audit row inside `tx` (docs/06 §1.6).
 */
import type { TxCtx } from "@/lib/db";
import type { RequestContext } from "@/lib/authz/context";
import type {
  CancelMyOrderInput,
  CheckoutPreview,
  CreateManualOrderInput,
  CreateManualOrderResult,
  CreateOrderInput,
  CreateOrderResult,
  ExpireOrdersResult,
  GetMyOrderInput,
  GetOrderAdminInput,
  ListMyOrdersInput,
  ListOrdersAdminInput,
  ListResult,
  Order,
  OrderAdminRow,
  OrderDetail,
  OrderPaymentHandle,
  OrderSummary,
  PreviewCheckoutInput,
  ProjectOrderSplitPayload,
  RetryPaymentInput,
} from "./types";

export interface OrdersService {
  /** API-COM-01 `previewCheckout` — applies coupon + tax, checks BR-10; `commerce.self`. */
  previewCheckout(ctx: RequestContext, input: PreviewCheckoutInput): Promise<CheckoutPreview>;

  /**
   * API-COM-02 `createOrder` — single offering; writes `orders(pending_payment, expires_at +7d)`,
   * `order_items(ownership_id = active)`, `payments(initiated)` with provider instructions.
   * Idempotent per `(userId, offeringId)` while a pending order exists (docs/06 §1.5).
   * Failures: `DUPLICATE_PURCHASE`, `STATE_INVALID`, `EMAIL_UNVERIFIED`, `RATE_LIMITED`.
   */
  createOrder(ctx: RequestContext, input: CreateOrderInput, tx?: TxCtx): Promise<CreateOrderResult>;

  /** API-COM-03 `cancelMyOrder` — `pending_payment → cancelled`; open payments → `failed`. */
  cancelMyOrder(
    ctx: RequestContext,
    input: CancelMyOrderInput,
    tx?: TxCtx,
  ): Promise<{ order: Order }>;

  /** API-COM-04 `retryPayment` — new `initiated` payment; `ORDER_EXPIRED` / `STATE_INVALID`. */
  retryPayment(
    ctx: RequestContext,
    input: RetryPaymentInput,
    tx?: TxCtx,
  ): Promise<{ payment: OrderPaymentHandle; expiresAt: string }>;

  /** API-COM-05 `listMyOrders` (query). */
  listMyOrders(ctx: RequestContext, input: ListMyOrdersInput): Promise<ListResult<OrderSummary>>;
  /** API-COM-05 `getMyOrder` (query) — `NOT_FOUND` when not the caller's order. */
  getMyOrder(ctx: RequestContext, input: GetMyOrderInput): Promise<OrderDetail>;

  /** API-COM-06 `listOrdersAdmin` (query) — `orders.read`, D-512 `own_product_orders` scope. */
  listOrdersAdmin(
    ctx: RequestContext,
    input: ListOrdersAdminInput,
  ): Promise<ListResult<OrderAdminRow>>;
  /** API-COM-06 `getOrderAdmin` (query). */
  getOrderAdmin(ctx: RequestContext, input: GetOrderAdminInput): Promise<OrderDetail>;

  /**
   * API-COM-07 `createManualOrder` — `orders.manual.write`. A `project` order also creates the
   * `project_order.split` approval request; a `product` order with `payment` is created and
   * confirmed (API-PAY-03) in the same transaction.
   */
  createManualOrder(
    ctx: RequestContext,
    input: CreateManualOrderInput,
    tx?: TxCtx,
  ): Promise<CreateManualOrderResult>;

  /**
   * API-COM-14 `applyProjectOrderSplit` (internal, apply handler for `project_order.split`):
   * stores `orders.split_approval_request_id`, enabling API-COM-11 / API-PAY-03 for the order.
   */
  applyProjectOrderSplit(
    payload: ProjectOrderSplitPayload,
    approvalRequestId: string,
    tx: TxCtx,
  ): Promise<void>;

  // -- internal transitions -------------------------------------------------------------------

  /**
   * Called by `payments.confirmPayment` inside its transaction: `orders.status='paid', paid_at`,
   * coupon redemption count, `user_offering_purchases` (BR-10). Not an API row on its own.
   */
  markPaid(orderId: string, paidAt: Date, tx: TxCtx): Promise<Order>;

  /**
   * Fulfilment rule (MASTER_SPEC §7 "Order fulfilled"): sets `fulfilled`/`fulfilled_at` when every
   * entitlement is `active` and every service checklist is complete. Called by delivery handlers.
   */
  evaluateFulfilled(orderId: string, tx: TxCtx): Promise<{ fulfilled: boolean }>;

  /** Cron `orders.expire` (docs/06 §3.3): `pending_payment` past `expires_at` → `failed` (BR-10). */
  expirePendingOrders(now?: Date, tx?: TxCtx): Promise<ExpireOrdersResult>;
}

/** Cache tags an orders mutation must revalidate (docs/06 §1.10) — none: orders are private. */
export const ORDERS_CACHE_TAGS: readonly string[] = [];
