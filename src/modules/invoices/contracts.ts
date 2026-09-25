/**
 * Invoices service contract (docs/06 §2.3 API-COM-11..13; credit notes for API-PAY-06).
 * All four tables are immutable (MASTER_SPEC §4.1); numbering is gapless per FY (BR-16).
 */
import type { TxCtx } from "@/lib/db";
import type { RequestContext } from "@/lib/authz/context";
import type { ListResult } from "@/modules/orders/types";
import type {
  GetInvoicePdfUrlInput,
  InvoiceRow,
  IssueCreditNoteInput,
  IssueCreditNoteResult,
  IssueInvoiceInput,
  IssueInvoiceResult,
  ListInvoicesAdminInput,
  ListMyInvoicesInput,
  PdfUrlResult,
  SequenceAllocation,
} from "./types";

export interface InvoicesService {
  /**
   * API-COM-11 `issueInvoice` — system on paid (inside `confirmPayment`'s tx) or `invoices.issue`
   * for project orders created without payment. Row-locks `invoice_sequences`, freezes seller
   * and buyer snapshots, `gst_breakdown` only with a GSTIN (D-1501); `E: invoice`, `N: invoice.issued`.
   * `STATE_INVALID` when an invoice exists (`order_id` unique) or the project split is not applied.
   */
  issueInvoice(
    input: IssueInvoiceInput,
    actor: { userId: string | null },
    tx: TxCtx,
  ): Promise<IssueInvoiceResult>;

  /** Credit note for an executed refund (API-PAY-06): `credit_note_sequences` lock + PDF. */
  issueCreditNote(
    input: IssueCreditNoteInput,
    actor: { userId: string | null },
    tx: TxCtx,
  ): Promise<IssueCreditNoteResult>;

  /** API-COM-12 `getInvoicePdfUrl` — 5-minute presigned GET; audited for admins. */
  getInvoicePdfUrl(ctx: RequestContext, input: GetInvoicePdfUrlInput): Promise<PdfUrlResult>;

  /** API-COM-13 `listInvoicesAdmin` (query) — `invoices.read`. */
  listInvoicesAdmin(
    ctx: RequestContext,
    input: ListInvoicesAdminInput,
  ): Promise<ListResult<InvoiceRow>>;
  /** API-COM-13 `listMyInvoices` (query) — `commerce.self`. */
  listMyInvoices(ctx: RequestContext, input: ListMyInvoicesInput): Promise<ListResult<InvoiceRow>>;

  // -- internal --------------------------------------------------------------------------------

  /** `SELECT … FOR UPDATE` on `invoice_sequences(fy)`, returns `CK/<fy>/<seq>` (BR-16). */
  nextInvoiceNumber(fy: string, tx: TxCtx): Promise<SequenceAllocation>;
  /** Same for `credit_note_sequences`, `CK/CN/<fy>/<seq>`. */
  nextCreditNoteNumber(fy: string, tx: TxCtx): Promise<SequenceAllocation>;
  /** Render (`@react-pdf/renderer`) to R2 `media(private)`; returns the media id. Ink-on-white. */
  renderInvoicePdf(invoiceId: string, tx: TxCtx): Promise<{ pdfMediaId: string }>;
  renderCreditNotePdf(creditNoteId: string, tx: TxCtx): Promise<{ pdfMediaId: string }>;
}
