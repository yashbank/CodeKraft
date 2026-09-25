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
] as const satisfies readonly QuoteStatus[];

export const QUOTE_STATUS_TRANSITIONS: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> =
  Object.freeze({
    draft: ["sent", "cancelled"],
    sent: ["accepted", "expired", "cancelled"],
    accepted: ["paid", "expired", "cancelled"],
    paid: [],
    expired: [],
    cancelled: [],
  });

/** Opaque acceptance token in `/quote/<token>` (rate class `quote_lookup`). */
export const zQuoteToken = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/, "quote token");

// ---------------------------------------------------------------------------------------------
// API-COM-09 createCustomQuote / sendCustomQuote / cancelCustomQuote — `orders.manual.write`
// ---------------------------------------------------------------------------------------------

export const createCustomQuoteInput = z
  .object({
    customerId: zUuid,
    offeringId: zUuid.optional(),
    title: zTrimmed(1, 200),
    description: zTrimmed(0, 4000).optional(),
    /** Base currency only in release 1 (D-502). */
    currency: zCurrency,
    amountMinor: zPositiveMinor,
    expiresAt: zIsoTimestamp.optional(),
  })
  .strict();
export type CreateCustomQuoteInput = z.infer<typeof createCustomQuoteInput>;

export const sendCustomQuoteInput = z.object({ quoteId: zUuid }).strict();
export type SendCustomQuoteInput = z.infer<typeof sendCustomQuoteInput>;

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
    "id" | "title" | "description" | "currency" | "amountMinor" | "status" | "expiresAt" | "orderId"
  >;
  canAccept: boolean;
}

export type { CustomQuote, QuoteStatus };
