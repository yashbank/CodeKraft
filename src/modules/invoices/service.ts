/**
 * `invoices` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P4; the signatures are
 * the frozen `InvoicesService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { InvoicesService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "invoices.<method> not implemented (P4)")`. */
export function createNotImplementedInvoicesService(): InvoicesService {
  return createNotImplemented<InvoicesService>("invoices", "P4", {
    issueInvoice: "async",
    issueCreditNote: "async",
    getInvoicePdfUrl: "async",
    listInvoicesAdmin: "async",
    listMyInvoices: "async",
    nextInvoiceNumber: "async",
    nextCreditNoteNumber: "async",
    renderInvoicePdf: "async",
    renderCreditNotePdf: "async",
  });
}
