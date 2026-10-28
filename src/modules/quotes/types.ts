/**
 * Custom quotes — Zod input schemas and output types (docs/06 §2.3 API-COM-09, API-COM-10; D-520;
 * MASTER_SPEC §7 "Custom quote pay link").
 */
import { z } from "zod";
import type { CustomQuote, QuoteStatus } from "../../../drizzle/schema/commerce";
import {
  currencySchema as zCurrency,
  isoDateTimeSchema as zIsoTimestamp,
  listParams as zListParams,
  positiveMinorUnitsSchema as zPositiveMinor,
  trimmedString as zTrimmed,
  uuidSchema as zUuid,
} from "@/modules/_shared/zod";
import { zBilling, zManualPaymentMethod } from "@/modules/orders/types";

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "paid",
  "expired",
  "cancelled",
  "viewed",
  "rejected",
] as const satisfies readonly QuoteStatus[];

export const QUOTE_STATUS_TRANSITIONS: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> =
  Object.freeze({
    draft: ["sent", "cancelled"],
    sent: ["viewed", "accepted", "rejected", "expired", "cancelled"],
    viewed: ["accepted", "rejected", "expired", "cancelled"],
    accepted: ["paid", "expired", "cancelled"],
    paid: [],
    rejected: [],
    expired: [],
    cancelled: [],
  });

/** Opaque acceptance token in `/quote/<token>` (rate class `quote_lookup`). */
export const zQuoteToken = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/, "quote token");

// ---------------------------------------------------------------------------------------------
// API-COM-09 createCustomQuote / sendCustomQuote / cancelCustomQuote — `orders.manual.write`
// ---------------------------------------------------------------------------------------------

export const quoteLineItemInput = z
  .object({
    description: zTrimmed(1, 300),
    quantity: z.number().int().positive().max(100000),
    unitMinor: zPositiveMinor,
  })
  .strict();

export const createCustomQuoteInput = z
  .object({
    customerId: zUuid,
    offeringId: zUuid.optional(),
    title: zTrimmed(1, 200),
    description: zTrimmed(0, 4000).optional(),
    currency: zCurrency,
    /** Required unless `lineItems` is given (then it must equal their sum, or be omitted). */
    amountMinor: zPositiveMinor.optional(),
    lineItems: z.array(quoteLineItemInput).min(1).max(50).optional(),
    /** Tax added on top of the amount, basis points (1800 = 18%). */
    taxBps: z.number().int().min(0).max(10000).optional(),
    internalNote: zTrimmed(0, 2000).optional(),
    expiresAt: zIsoTimestamp.optional(),
  })
  .strict()
  .refine((v) => v.amountMinor !== undefined || v.lineItems !== undefined, {
    message: "Enter an amount or add at least one line item",
    path: ["amountMinor"],
  });
export type CreateCustomQuoteInput = z.infer<typeof createCustomQuoteInput>;

/** `expiresAt` optionally sets a new validity date (needed to resend an already expired quote). */
export const sendCustomQuoteInput = z
  .object({ quoteId: zUuid, expiresAt: zIsoTimestamp.optional() })
  .strict();
export type SendCustomQuoteInput = z.infer<typeof sendCustomQuoteInput>;

export const rejectCustomQuoteInput = z
  .object({ token: zQuoteToken, reason: zTrimmed(0, 500).optional() })
  .strict();
export type RejectCustomQuoteInput = z.infer<typeof rejectCustomQuoteInput>;

export const searchCustomersInput = z.object({ q: zTrimmed(0, 100) }).strict();
export type SearchCustomersInput = z.infer<typeof searchCustomersInput>;

export const cancelCustomQuoteInput = z
  .object({ quoteId: zUuid, reason: zTrimmed(0, 500).optional() })
  .strict();
export type CancelCustomQuoteInput = z.infer<typeof cancelCustomQuoteInput>;

export const listQuotesInput = zListParams(
  ["createdAt", "expiresAt", "status"],
  z.object({ status: z.enum(QUOTE_STATUSES).optional(), customerId: zUuid.optional() }).strict(),
);
export type ListQuotesInput = z.infer<typeof listQuotesInput>;

export interface CreateQuoteResult {
  quoteId: string;
  token: string;
  /** `/quote/<token>` */
  payUrl: string;
}

// ---------------------------------------------------------------------------------------------
// API-COM-10 getQuote (query) / acceptCustomQuote
// ---------------------------------------------------------------------------------------------

export const getQuoteInput = z.object({ token: zQuoteToken }).strict();
export type GetQuoteInput = z.infer<typeof getQuoteInput>;

export const acceptCustomQuoteInput = z
  .object({ token: zQuoteToken, paymentMethod: zManualPaymentMethod, billing: zBilling })
  .strict();
export type AcceptCustomQuoteInput = z.infer<typeof acceptCustomQuoteInput>;

/** `canAccept` is false when the session user is not `custom_quotes.customer_id`. */
export interface QuoteView {
  quote: Pick<
    CustomQuote,
    | "id"
    | "title"
    | "description"
    | "currency"
    | "amountMinor"
    | "status"
    | "expiresAt"
    | "orderId"
    | "taxBps"
    | "lineItems"
  >;
  canAccept: boolean;
}

export type { CustomQuote, QuoteStatus };
