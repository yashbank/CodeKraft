/**
 * Payments service contract (docs/06 §2.4 API-PAY-01..08, §4.1 orchestration, §5.1–5.2).
 *
 * `confirmPayment` owns the orchestration: load provider by `payments.provider` →
 * `provider.confirm()` → `payments` → `orders.markPaid` → `finance.postOrderPaid` →
 * `invoices.issueInvoice` → `entitlements.grantForOrder` — all inside one transaction.
 */
import type { TxCtx } from "@/lib/db";
import type { RequestContext } from "@/lib/authz/context";
import type { PaymentInstructions, PaymentMethodKey, ProviderRegistry } from "./provider";
import type {
  ApplyRefundResult,
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  FailPaymentInput,
  FailPaymentResult,
  FlagChargebackInput,
  GetPaymentInstructionsInput,
  ListPaymentsAwaitingInput,
  PaymentAwaitingRow,
  ProposeRefundInput,
  ProposeRefundResult,
  RefundIssuePayload,
  SubmitPaymentReferenceInput,
  SubmitPaymentReferenceResult,
} from "./types";

export interface PaymentsService {
  readonly providers: ProviderRegistry;

  /** API-PAY-01 `getPaymentInstructions` (query) — `commerce.self`, own payment only. */
  getPaymentInstructions(
    ctx: RequestContext,
    input: GetPaymentInstructionsInput,
  ): Promise<PaymentInstructions>;

  /**
   * API-PAY-02 `submitPaymentReference` — `initiated|submitted → submitted`; `N: payment.submitted`
   * to admins (in-app only, D-707). Failures: `STATE_INVALID`, `ORDER_EXPIRED`, `RATE_LIMITED`.
   */
  submitPaymentReference(
    ctx: RequestContext,
    input: SubmitPaymentReferenceInput,
    tx?: TxCtx,
  ): Promise<SubmitPaymentReferenceResult>;

  /**
   * API-PAY-03 `confirmPayment` — `payments.confirm`. One transaction: payment `confirmed`
   * (immutable), order `paid`, ledger + allocations, invoice, entitlements (docs/06 §5.1 step 5).
   * Idempotent per docs/06 §1.5: same amounts + reference → `IDEMPOTENT_REPLAY`, different →
   * `STATE_INVALID`. Project orders need an applied `project_order.split` (`STATE_INVALID`).
   */
  confirmPayment(
    ctx: RequestContext,
    input: ConfirmPaymentInput,
    tx?: TxCtx,
  ): Promise<ConfirmPaymentResult>;

  /** API-PAY-04 `failPayment` — `STATE_INVALID` if `confirmed`. */
  failPayment(ctx: RequestContext, input: FailPaymentInput, tx?: TxCtx): Promise<FailPaymentResult>;

  /** API-PAY-05 `proposeRefund` — `refunds.propose`; creates the `refund.issue` request. */
  proposeRefund(
    ctx: RequestContext,
    input: ProposeRefundInput,
    tx?: TxCtx,
  ): Promise<ProposeRefundResult>;

  /**
   * API-PAY-06 `applyRefund` (internal, apply handler for `refund.issue`): `refunds.executed_*`,
   * `finance.postRefund`, credit note, order status, `payments.amount_refunded_minor`
   * (+ `confirmed → refunded` when fully refunded), entitlements revoked via handlers.
   */
  applyRefund(
    payload: RefundIssuePayload,
    approvalRequestId: string,
    tx: TxCtx,
  ): Promise<ApplyRefundResult>;

  /** API-PAY-07 `listPaymentsAwaiting` (query, widget loader). */
  listPaymentsAwaiting(
    ctx: RequestContext,
    input: ListPaymentsAwaitingInput,
  ): Promise<PaymentAwaitingRow[]>;

  /** API-PAY-08 `flagChargeback` — gateway payments only (V1.1). */
  flagChargeback(
    ctx: RequestContext,
    input: FlagChargebackInput,
    tx?: TxCtx,
  ): Promise<{ ok: true }>;

  // -- internal, used by orders (API-COM-02/04/07/10) ----------------------------------------------

  /** Insert an `initiated` payment with provider instructions for `orderId`. */
  createIntentForOrder(
    orderId: string,
    method: PaymentMethodKey,
    tx: TxCtx,
  ): Promise<{ paymentId: string; instructions: PaymentInstructions }>;
}

/** Refund apply is keyed by `approvalRequestId` (docs/06 §1.5) — never re-applied. */
export const REFUND_IDEMPOTENCY_KEY = "approvalRequestId" as const;
