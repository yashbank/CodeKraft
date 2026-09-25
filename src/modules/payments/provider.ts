/**
 * Payment provider contract — docs/06 §4.1 verbatim (architecture §7.1, A-402, MASTER_SPEC §4.4).
 *
 * Frozen in P2 (master plan §5). `confirm` returns amounts and NEVER writes ledger/orders; the
 * order, finance, invoice and entitlement modules receive only the four amounts and never see
 * the provider key. Release 1 ships `ManualProvider` only (D-501); gateways are V1.1 (§4.3).
 *
 * Note: the *persisted* `payments.instructions` JSON (drizzle/schema/commerce `PaymentInstructions`)
 * flattens `amount` to `amountMinor`/`currency` and names the bank column `accountNumber`; the
 * shapes here are the API view (docs/06 §2.4 API-PAY-01) that the service maps to and from.
 */
import type { TxCtx } from "@/lib/db";
import type { Money } from "@/lib/money";
import type { Payment } from "../../../drizzle/schema/commerce";

export const PAYMENT_METHOD_KEYS = [
  "manual_upi",
  "manual_bank",
  "razorpay",
  "stripe",
  "paypal",
] as const;
export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[number];

/** Methods served by `ManualProvider` (docs/06 §4.2 `keys`). */
export const MANUAL_PROVIDER_KEYS = [
  "manual_upi",
  "manual_bank",
] as const satisfies readonly PaymentMethodKey[];
export type ManualMethodKey = (typeof MANUAL_PROVIDER_KEYS)[number];
export const GATEWAY_METHOD_KEYS = [
  "razorpay",
  "stripe",
  "paypal",
] as const satisfies readonly PaymentMethodKey[];
export type GatewayMethodKey = (typeof GATEWAY_METHOD_KEYS)[number];

export type JsonPrimitive = string | number | boolean | null;
export type Json = JsonPrimitive | Json[] | { [key: string]: Json };

// ---------------------------------------------------------------------------------------------
// Instructions rendered to the customer (docs/06 §2.4 API-PAY-01)
// ---------------------------------------------------------------------------------------------

export interface UpiInstructions {
  method: "manual_upi";
  vpa: string;
  /** Always `CodeKraft` (docs/06 §4.2). */
  payeeName: string;
  amount: Money;
  /** `orderNo` — the customer's transfer note. */
  note: string;
  /** `upi://pay?pa=<vpa>&pn=CodeKraft&am=<rupees 2dp>&cu=INR&tn=<orderNo>` */
  upiUri: string;
  qrDataUrl: string;
}

export interface BankInstructions {
  method: "manual_bank";
  accountName: string;
  accountNo: string;
  ifsc: string;
  bankName: string;
  branch?: string;
  swift?: string;
  amount: Money;
  /** `orderNo` — quoted by the customer on the transfer. */
  reference: string;
}

/** V1.1 gateway intents (docs/06 §4.3). */
export interface GatewayInstructions {
  method: GatewayMethodKey;
  kind: "redirect" | "client_sdk";
  [key: string]: Json | undefined;
}

export type PaymentInstructions = UpiInstructions | BankInstructions | GatewayInstructions;

// ---------------------------------------------------------------------------------------------
// Provider inputs / outputs (docs/06 §4.1)
// ---------------------------------------------------------------------------------------------

/** What `createIntent` needs from the order — never the whole row (MASTER_SPEC §4.4). */
export interface OrderForPayment {
  orderId: string;
  orderNo: string;
  amountDue: Money;
  customer: { name: string; email: string };
}

export type PaymentRow = Payment;

export interface ConfirmInput {
  amountReceivedMinor: number;
  reference: string;
  /** `YYYY-MM-DD` */
  receivedOn: string;
  gatewayFeeMinor?: number;
  actorId: string | "webhook";
}

export interface PaymentResult {
  status: "confirmed" | "failed";
  amountReceivedMinor: number;
  gatewayFeeMinor: number;
  /** `max(0, amountDue − amountReceived)` (D-516) — posted as `bank_charge`. */
  bankShortfallMinor: number;
  /** `max(0, amountReceived − amountDue)` — recorded, shown to admins, never allocated. */
  customerCreditMinor: number;
  reference: string;
  providerPayload?: Json;
  failureReason?: string;
}

export interface RefundResult {
  /** `recorded`: manual transfer done by hand (BR-09); `processed`: gateway refund executed. */
  status: "recorded" | "processed" | "failed";
  reference?: string;
  providerPayload?: Json;
  failureReason?: string;
}

/** Typed, side-effect-free webhook event (gateways only, V1.1). */
export interface WebhookOutcome {
  provider: GatewayMethodKey;
  /** Stored in `webhook_events(provider, event_id)` for idempotency (docs/05 §11). */
  eventId: string;
  kind: "payment.captured" | "payment.failed" | "refund.processed" | "ignored";
  paymentId?: string;
  amountMinor?: number;
  feeMinor?: number;
  payload: Json;
}

export interface CreateIntentResult {
  instructions: PaymentInstructions;
  providerPayload?: Json;
}

export interface PaymentProvider {
  /** Methods this provider serves. */
  readonly keys: PaymentMethodKey[];
  createIntent(
    ctx: TxCtx,
    order: OrderForPayment,
    method: PaymentMethodKey,
  ): Promise<CreateIntentResult>;
  /** Returns amounts; NEVER writes ledger/orders. */
  confirm(ctx: TxCtx, payment: PaymentRow, input: ConfirmInput): Promise<PaymentResult>;
  refund?(
    ctx: TxCtx,
    payment: PaymentRow,
    amountMinor: number,
    reason: string,
  ): Promise<RefundResult>;
  /** Gateways only; returns a typed event, side-effect free. */
  handleWebhook?(req: Request): Promise<WebhookOutcome>;
}

/**
 * Method and parameter names of docs/06 §4.1, for the P2.8 fixture comparison and the contract
 * freeze test. Any change here needs an ADR.
 */
export const PAYMENT_PROVIDER_CONTRACT = Object.freeze({
  keys: [] as const,
  createIntent: ["ctx", "order", "method"] as const,
  confirm: ["ctx", "payment", "input"] as const,
  refund: ["ctx", "payment", "amountMinor", "reason"] as const,
  handleWebhook: ["req"] as const,
});

// ---------------------------------------------------------------------------------------------
// Registry (docs/06 §4.3 `providers/registry.ts`, gated by `provider_*` flags)
// ---------------------------------------------------------------------------------------------

export interface ProviderRegistry {
  /** Provider serving `method`; throws `STATE_INVALID` when the method is not enabled. */
  get(method: PaymentMethodKey): PaymentProvider;
  has(method: PaymentMethodKey): boolean;
  register(provider: PaymentProvider): void;
  /** Methods enabled by settings + feature flags, in display order. */
  enabledMethods(): PaymentMethodKey[];
}

// ---------------------------------------------------------------------------------------------
// ManualProvider (docs/06 §4.2)
// ---------------------------------------------------------------------------------------------

export interface BankDetails {
  accountName: string;
  accountNo: string;
  ifsc: string;
  bankName: string;
  branch?: string;
  swift?: string;
}

/** Settings and renderers the manual provider reads; injected so the provider is unit-testable. */
export interface ManualProviderDeps {
  getUpiVpa(tx: TxCtx): Promise<string | null>;
  getBankDetails(tx: TxCtx): Promise<BankDetails | null>;
  getBaseCurrency(tx: TxCtx): Promise<Money["currency"]>;
  /** `qrcode` → data URL. */
  renderQr(upiUri: string): Promise<string>;
}

/** Amounts the manual `confirm` derives (docs/06 §4.2) — `gatewayFeeMinor` is always 0. */
export interface ManualConfirmAmounts {
  amountReceivedMinor: number;
  gatewayFeeMinor: 0;
  bankShortfallMinor: number;
  customerCreditMinor: number;
}

/**
 * Pure reference computation of the `ManualProvider.confirm` amounts: shortfall and credit are
 * mutually exclusive, and `received + shortfall − credit = due`.
 */
export function computeManualConfirmAmounts(
  amountDueMinor: number,
  amountReceivedMinor: number,
): ManualConfirmAmounts {
  if (!Number.isSafeInteger(amountDueMinor) || amountDueMinor < 0) {
    throw new RangeError("amountDueMinor must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(amountReceivedMinor) || amountReceivedMinor < 0) {
    throw new RangeError("amountReceivedMinor must be a non-negative safe integer");
  }
  const diff = amountDueMinor - amountReceivedMinor;
  return {
    amountReceivedMinor,
    gatewayFeeMinor: 0,
    bankShortfallMinor: diff > 0 ? diff : 0,
    customerCreditMinor: diff < 0 ? -diff : 0,
  };
}
