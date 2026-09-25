/**
 * Invoices and credit notes — Zod input schemas and output types (docs/06 §2.3 API-COM-11..13,
 * API-PAY-06 credit note; BR-16 gapless numbering per financial year; D-1501).
 */
import { z } from "zod";
import type {
  BuyerSnapshot,
  CreditNote,
  GstBreakdown,
  Invoice,
  InvoiceLine,
  SellerSnapshot,
} from "../../../drizzle/schema/invoices";
import { listParams as zListParams, uuidSchema as zUuid } from "@/modules/_shared/zod";
import { zDateRange, zFyLabel } from "@/modules/orders/types";

/** `CK/2026-27/0001` (BR-16). */
export const zInvoiceNo = z.string().regex(/^CK\/\d{4}-\d{2}\/\d{4,}$/, "invoice number");
/** `CK/CN/2026-27/0001`. */
export const zCreditNo = z.string().regex(/^CK\/CN\/\d{4}-\d{2}\/\d{4,}$/, "credit note number");

/** Presigned GET lifetime for invoice / credit-note PDFs (docs/06 API-COM-12). */
export const INVOICE_PDF_URL_TTL_SECONDS = 300;

// ---------------------------------------------------------------------------------------------
// API-COM-11 issueInvoice (internal on paid + manual re-issue for project orders)
// ---------------------------------------------------------------------------------------------

export const issueInvoiceInput = z.object({ orderId: zUuid }).strict();
export type IssueInvoiceInput = z.infer<typeof issueInvoiceInput>;

export interface IssueInvoiceResult {
  invoiceId: string;
  invoiceNo: string;
  /** Null when rendering is deferred (webhook-driven confirmations, docs/06 §3). */
  pdfMediaId: string | null;
}

/** Credit note for an applied refund (API-PAY-06). */
export const issueCreditNoteInput = z.object({ refundId: zUuid }).strict();
export type IssueCreditNoteInput = z.infer<typeof issueCreditNoteInput>;

export interface IssueCreditNoteResult {
  creditNoteId: string;
  creditNo: string;
  pdfMediaId: string | null;
}

/** Gapless allocation under `SELECT … FOR UPDATE` on the sequences table (BR-16, docs/05 §12). */
export interface SequenceAllocation {
  fy: string;
  seq: number;
  number: string;
}

// ---------------------------------------------------------------------------------------------
// API-COM-12 getInvoicePdfUrl — `commerce.self` (own) / `invoices.read`
// ---------------------------------------------------------------------------------------------

export const getInvoicePdfUrlInput = z.union([
  z.object({ invoiceId: zUuid }).strict(),
  z.object({ creditNoteId: zUuid }).strict(),
]);
export type GetInvoicePdfUrlInput = z.infer<typeof getInvoicePdfUrlInput>;

export interface PdfUrlResult {
  url: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------------------------
// API-COM-13 listInvoicesAdmin / listMyInvoices (query)
// ---------------------------------------------------------------------------------------------

export const listInvoicesAdminInput = zListParams(
  ["issuedAt", "invoiceNo", "total"],
  z.object({ fy: zFyLabel.optional(), ...zDateRange }).strict(),
);
export type ListInvoicesAdminInput = z.infer<typeof listInvoicesAdminInput>;

export const listMyInvoicesInput = zListParams(["issuedAt"]);
export type ListMyInvoicesInput = z.infer<typeof listMyInvoicesInput>;

export interface InvoiceRow {
  invoiceId: string;
  invoiceNo: string;
  orderId: string;
  orderNo: string;
  fy: string;
  issuedAt: string;
  totalMinor: number;
  taxMinor: number;
  currency: string;
  buyer: Pick<BuyerSnapshot, "name" | "email" | "company">;
  creditNotes: { creditNoteId: string; creditNo: string; amountMinor: number; issuedAt: string }[];
  pdfMediaId: string | null;
}

export type { BuyerSnapshot, CreditNote, GstBreakdown, Invoice, InvoiceLine, SellerSnapshot };
