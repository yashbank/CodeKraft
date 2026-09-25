/**
 * Payments and refunds — Zod input schemas and output types (docs/06 §2.4 API-PAY-01..08).
 * `modules/refunds` lives inside this module (docs/06 §2.4 heading).
 */
import { z } from "zod";
import type { Order, Payment, PaymentStatus, Refund } from "../../../drizzle/schema/commerce";
import {
  zIsoDate,
  zIsoTimestamp,
  zMinor,
  zPositiveMinor,
  zTrimmed,
  zUuid,
} from "@/modules/orders/types";
import type { PaymentInstructions } from "./provider";

export const PAYMENT_STATUSES = [
  "initiated",
  "submitted",
  "confirmed",
  "failed",
  "refunded",
] as const satisfies readonly PaymentStatus[];

/**
 * Payment state machine (docs/05 §12, MASTER_SPEC §7 "Payment immutability"): after `confirmed`
 * the only transition is `→ refunded`, and the only mutable column is `amount_refunded_minor`.
 * `submitted → submitted` is the customer re-submitting a reference (API-PAY-02).
 */
export const PAYMENT_STATUS_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> =
  Object.freeze({
    initiated: ["submitted", "confirmed", "failed"],
    submitted: ["submitted", "confirmed", "failed"],
    confirmed: ["refunded"],
    failed: [],
    refunded: [],
  });

/** Re-submission of a `submitted` reference re-notifies admins at most once per 10 minutes. */
export const RESUBMIT_NOTIFY_WINDOW_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// API-PAY-01 getPaymentInstructions (query)
// ---------------------------------------------------------------------------------------------

export const getPaymentInstructionsInput = z.object({ paymentId: zUuid }).strict();
export type GetPaymentInstructionsInput = z.infer<typeof getPaymentInstructionsInput>;

// ---------------------------------------------------------------------------------------------
// API-PAY-02 submitPaymentReference — customer security event (audited)
// ---------------------------------------------------------------------------------------------

export const submitPaymentReferenceInput = z
  .object({
    paymentId: zUuid,
    /** UTR / transaction id. */
    reference: zTrimmed(6, 64),
    paidAt: zIsoTimestamp.optional(),
    note: zTrimmed(0, 500).optional(),
  })
  .strict();
export type SubmitPaymentReferenceInput = z.infer<typeof submitPaymentReferenceInput>;

export interface SubmitPaymentReferenceResult {
  payment: { paymentId: string; status: "submitted" };
}

// ---------------------------------------------------------------------------------------------
// API-PAY-03 confirmPayment (D-516) — idempotent on (paymentId, target status), docs/06 §1.5
// ---------------------------------------------------------------------------------------------

export const confirmPaymentInput = z
  .object({
    paymentId: zUuid,
    /** ≥ 0; overpayment is allowed and stored as `customer_credit_minor`. */
    amountReceivedMinor: zMinor,
    /** Admin's statement reference; overrides the customer's if different (both kept, §4.2). */
    reference: zTrimmed(1, 120),
    receivedOn: zIsoDate,
    note: zTrimmed(0, 500).optional(),
    /** Confirm an `ORDER_EXPIRED` order anyway (audited). */
    overrideExpiry: z.boolean().default(false),
  })
  .strict();
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentInput>;

export interface ConfirmPaymentResult {
  payment: Payment;
  order: Order;
  invoiceNo: string | null;
  entitlementIds: string[];
  ledgerEntryCount: number;
  shortfallMinor: number;
  customerCreditMinor: number;
}

/**
 * Amounts handed to orders / finance / invoices / entitlements after confirm — never the provider
 * key (docs/06 §4.1, MASTER_SPEC §4.4).
 */
export interface ConfirmedAmounts {
  amountReceivedMinor: number;
  gatewayFeeMinor: number;
  bankShortfallMinor: number;
  customerCreditMinor: number;
}

// ---------------------------------------------------------------------------------------------
// API-PAY-04 failPayment
// ---------------------------------------------------------------------------------------------

export const failPaymentInput = z
  .object({
    paymentId: zUuid,
    reason: zTrimmed(1, 500),
    /** Default: order stays `pending_payment` so the customer may retry (D-416). */
    alsoCancelOrder: z.boolean().default(false),
  })
  .strict();
export type FailPaymentInput = z.infer<typeof failPaymentInput>;

export interface FailPaymentResult {
  payment: Payment;
  order: Order;
}

// ---------------------------------------------------------------------------------------------
// API-PAY-05 proposeRefund → `refund.issue` approval (BR-09, BR-13)
// ---------------------------------------------------------------------------------------------

export const proposeRefundInput = z
  .object({
    orderId: zUuid,
    paymentId: zUuid,
    /** ≤ confirmed amount − already refunded (checked in the service). */
    amountMinor: zPositiveMinor,
    reason: zTrimmed(1, 500),
    revokeEntitlements: z.boolean().default(true),
    queryId: zUuid.optional(),
    /** Refund a non-refundable product anyway (audited). */
    policyException: z.boolean().default(false),
  })
  .strict();
export type ProposeRefundInput = z.infer<typeof proposeRefundInput>;

export interface ProposeRefundResult {
  refundId: string;
  approvalRequestId: string;
}

// ---------------------------------------------------------------------------------------------
// API-PAY-06 applyRefund (internal) — approval payload for `refund.issue`
// ---------------------------------------------------------------------------------------------

export const refundIssuePayload = z.object({ refundId: zUuid }).strict();
export type RefundIssuePayload = z.infer<typeof refundIssuePayload>;

export interface ApplyRefundResult {
  refund: Refund;
  creditNoteId: string;
  ledgerEntryCount: number;
  revokedEntitlementIds: string[];
  orderStatus: Order["status"];
}

// ---------------------------------------------------------------------------------------------
// API-PAY-07 listPaymentsAwaiting (query, widget loader `payments_awaiting`)
// ---------------------------------------------------------------------------------------------

export const listPaymentsAwaitingInput = z
  .object({ status: z.enum(["submitted", "initiated"]).optional() })
  .strict();
export type ListPaymentsAwaitingInput = z.infer<typeof listPaymentsAwaitingInput>;

export interface PaymentAwaitingRow {
  paymentId: string;
  status: "submitted" | "initiated";
  ageHours: number;
  order: {
    orderId: string;
    orderNo: string;
    totalMinor: number;
    currency: string;
    expiresAt: string | null;
  };
  customer: { userId: string | null; name: string; email: string };
  customerReference: string | null;
  customerSubmittedAt: string | null;
}

// ---------------------------------------------------------------------------------------------
// API-PAY-08 flagChargeback (gateway payments only, V1.1)
// ---------------------------------------------------------------------------------------------

export const flagChargebackInput = z.object({ paymentId: zUuid, note: zTrimmed(1, 500) }).strict();
export type FlagChargebackInput = z.infer<typeof flagChargebackInput>;

export type { Payment, PaymentInstructions, PaymentStatus, Refund };
