/**
 * Invoices service implementation (docs/06 §2.3 API-COM-11..13, API-PAY-06, BR-16, D-1501).
 */
import crypto from "node:crypto";
import { and, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { getDb, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { settingsService } from "@/modules/settings/service";
import { auditService } from "@/modules/audit/service";
import { getDocumentsBucketName, getStorageDriver } from "@/lib/storage";
import {
  invoices,
  creditNotes,
  type BuyerSnapshot,
  type GstBreakdown,
  type InvoiceLine,
  type SellerSnapshot,
} from "../../../drizzle/schema/invoices";
import { orders, orderItems, refunds } from "../../../drizzle/schema/commerce";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { media } from "../../../drizzle/schema/media";
import { emailOutbox, notifications } from "../../../drizzle/schema/notifications";
import type { InvoicesService } from "./contracts";
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
import { INVOICE_PDF_URL_TTL_SECONDS } from "./types";
import { computeFy, nextCreditNoteNumber, nextInvoiceNumber } from "./numbering";
import { computeGstBreakdown } from "./gst";
import { buildPdfBuffer, uploadDocumentPdf } from "./pdf";
import { createNotImplemented } from "@/modules/_shared/not-implemented";

export class DefaultInvoicesService implements InvoicesService {
  private readonly fallback = createNotImplementedInvoicesService();

  // -- API-COM-11 issueInvoice -------------------------------------------------------------------

  async issueInvoice(
    input: IssueInvoiceInput,
    actor: { userId: string | null },
    tx: TxCtx,
  ): Promise<IssueInvoiceResult> {
    const [existing] = await tx
      .select({ id: invoices.id, invoiceNo: invoices.invoiceNo, pdfMediaId: invoices.pdfMediaId })
      .from(invoices)
      .where(eq(invoices.orderId, input.orderId))
      .limit(1);

    if (existing) {
      throw new AppError(ErrorCode.STATE_INVALID, "Invoice already exists for this order");
    }

    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
    }

    if (order.type === "project") {
      if (!order.splitApprovalRequestId) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Project order requires split approval before invoice issue",
        );
      }
      const [approval] = await tx
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, order.splitApprovalRequestId))
        .limit(1);

      if (!approval || approval.status !== "applied") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Project order split approval must be applied before invoice issue",
        );
      }
    }

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    if (items.length === 0) {
      throw new AppError(ErrorCode.STATE_INVALID, "Order has no items to invoice");
    }

    const settings = await settingsService.load(tx);

    const paidDate = order.paidAt ?? new Date();
    const fy = computeFy(paidDate);
    const seqAlloc = await nextInvoiceNumber(fy, tx);

    const sellerDetails = settings.sellerDetails;
    const sellerAddressStr = sellerDetails?.address
      ? `${sellerDetails.address.line1}, ${sellerDetails.address.city}, ${sellerDetails.address.postalCode}`
      : "Bangalore, India";

    const sellerSnapshot: SellerSnapshot = {
      name: sellerDetails?.name || "CodeKraft",
      address: sellerAddressStr,
      gst_number: settings.gstin || null,
      email: sellerDetails?.email || "billing@codekraft.dev",
      state_code: order.taxSnapshot?.seller_state ?? "KA",
    };

    const buyerSnapshot: BuyerSnapshot = {
      name: order.billingSnapshot.name || "Customer",
      email: order.billingSnapshot.email || "",
      country: order.billingSnapshot.country || "IN",
      company: order.billingSnapshot.company || null,
      address: order.billingSnapshot.address || null,
      gst_number: order.billingSnapshot.gst_number || null,
      state_code: order.taxSnapshot?.buyer_state || null,
    };

    const gstBreakdown = computeGstBreakdown({
      buyerState: buyerSnapshot.state_code,
      sellerState: sellerSnapshot.state_code,
      taxMinor: order.taxMinor,
      taxRateBps: order.taxRateBps,
      gstin: sellerSnapshot.gst_number,
    });

    const lines: InvoiceLine[] = items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_minor: i.unitMinor,
      discount_minor: i.discountMinor,
      tax_minor: i.taxMinor,
      total_minor: i.totalMinor,
    }));

    const [newInvoice] = await tx
      .insert(invoices)
      .values({
        invoiceNo: seqAlloc.number,
        orderId: order.id,
        fy,
        seq: seqAlloc.seq,
        issuedAt: new Date(),
        sellerSnapshot,
        buyerSnapshot,
        lines,
        subtotalMinor: order.subtotalMinor,
        discountMinor: order.discountMinor,
        taxMinor: order.taxMinor,
        totalMinor: order.totalMinor,
        currency: order.currency,
        gstBreakdown: gstBreakdown ?? null,
      })
      .returning();

    // Render PDF and upload
    const { pdfMediaId } = await this.renderInvoicePdf(newInvoice!.id, tx);

    // Customer notification
    if (order.userId) {
      await tx.insert(notifications).values({
        userId: order.userId,
        type: "invoice.issued",
        title: "Invoice issued",
        body: `Invoice ${seqAlloc.number} has been issued`,
        link: `/account/invoices`,
        payload: { invoiceId: newInvoice!.id, invoiceNo: seqAlloc.number },
      });
    }

    // Email outbox
    if (buyerSnapshot.email) {
      await tx.insert(emailOutbox).values({
        toEmail: buyerSnapshot.email,
        template: "invoice",
        payload: {
          invoiceId: newInvoice!.id,
          invoiceNo: seqAlloc.number,
          orderNo: order.orderNo,
          total: (order.totalMinor / 100).toFixed(2),
          currency: order.currency,
        },
        priority: 2,
      });
    }

    return {
      invoiceId: newInvoice!.id,
      invoiceNo: seqAlloc.number,
      pdfMediaId,
    };
  }

  // -- issueCreditNote (API-PAY-06) --------------------------------------------------------------

  async issueCreditNote(
    input: IssueCreditNoteInput,
    actor: { userId: string | null },
    tx: TxCtx,
  ): Promise<IssueCreditNoteResult> {
    const [refund] = await tx
      .select()
      .from(refunds)
      .where(eq(refunds.id, input.refundId))
      .limit(1);

    if (!refund) {
      throw new AppError(ErrorCode.NOT_FOUND, "Refund not found");
    }

    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, refund.orderId))
      .limit(1);

    if (!invoice) {
      throw new AppError(ErrorCode.STATE_INVALID, "No invoice found for refunded order");
    }

    const fy = computeFy(refund.executedAt ?? new Date());
    const seqAlloc = await nextCreditNoteNumber(fy, tx);

    const [cn] = await tx
      .insert(creditNotes)
      .values({
        creditNo: seqAlloc.number,
        invoiceId: invoice.id,
        refundId: refund.id,
        fy,
        seq: seqAlloc.seq,
        amountMinor: refund.amountMinor,
        currency: refund.currency,
        issuedAt: new Date(),
      })
      .returning();

    await tx
      .update(refunds)
      .set({ creditNoteId: cn!.id })
      .where(eq(refunds.id, refund.id));

    const { pdfMediaId } = await this.renderCreditNotePdf(cn!.id, tx);

    return {
      creditNoteId: cn!.id,
      creditNo: seqAlloc.number,
      pdfMediaId,
    };
  }

  // -- API-COM-12 getInvoicePdfUrl ---------------------------------------------------------------

  async getInvoicePdfUrl(
    ctx: RequestContext,
    input: GetInvoicePdfUrlInput,
  ): Promise<PdfUrlResult> {
    const db = await getDb();
    const isAdmin = ctx.roles.includes("admin") || ctx.roles.includes("super_admin");

    let objectKey: string;
    let entityId: string;
    let entityNo: string;

    if ("invoiceId" in input) {
      const [row] = await db
        .select({
          invoice: invoices,
          order: orders,
        })
        .from(invoices)
        .innerJoin(orders, eq(invoices.orderId, orders.id))
        .where(eq(invoices.id, input.invoiceId))
        .limit(1);

      if (!row) {
        throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
      }

      if (!isAdmin && row.order.userId !== ctx.userId) {
        throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found"); // SA-10: foreign customer gets NOT_FOUND
      }

      if (isAdmin) {
        assertPermission(ctx, "invoices.read");
        await auditService.log(
          ctx,
          "invoice.viewed",
          { type: "invoice", id: row.invoice.id },
          null,
          { invoiceNo: row.invoice.invoiceNo },
          db as unknown as TxCtx,
        );
      }

      objectKey = `invoices/${row.invoice.fy}/${row.invoice.invoiceNo.replace(/\//g, "-")}.pdf`;
      entityId = row.invoice.id;
      entityNo = row.invoice.invoiceNo;
    } else {
      const [row] = await db
        .select({
          creditNote: creditNotes,
          invoice: invoices,
          order: orders,
        })
        .from(creditNotes)
        .innerJoin(invoices, eq(creditNotes.invoiceId, invoices.id))
        .innerJoin(orders, eq(invoices.orderId, orders.id))
        .where(eq(creditNotes.id, input.creditNoteId))
        .limit(1);

      if (!row) {
        throw new AppError(ErrorCode.NOT_FOUND, "Credit note not found");
      }

      if (!isAdmin && row.order.userId !== ctx.userId) {
        throw new AppError(ErrorCode.NOT_FOUND, "Credit note not found");
      }

      if (isAdmin) {
        assertPermission(ctx, "invoices.read");
        await auditService.log(
          ctx,
          "credit_note.viewed",
          { type: "credit_note", id: row.creditNote.id },
          null,
          { creditNo: row.creditNote.creditNo },
          db as unknown as TxCtx,
        );
      }

      objectKey = `credit_notes/${row.creditNote.fy}/${row.creditNote.creditNo.replace(/\//g, "-")}.pdf`;
      entityId = row.creditNote.id;
      entityNo = row.creditNote.creditNo;
    }

    const driver = getStorageDriver();
    const bucket = getDocumentsBucketName();
    const url = await driver.createPresignedGet(bucket, objectKey, INVOICE_PDF_URL_TTL_SECONDS);
    const expiresAt = new Date(Date.now() + INVOICE_PDF_URL_TTL_SECONDS * 1000).toISOString();

    return { url, expiresAt };
  }

  // -- API-COM-13 listInvoicesAdmin --------------------------------------------------------------

  async listInvoicesAdmin(
    ctx: RequestContext,
    input: ListInvoicesAdminInput,
  ): Promise<{ items: InvoiceRow[]; nextCursor: string | null }> {
    assertPermission(ctx, "invoices.read");
    const db = await getDb();

    const limit = input.limit ?? 25;
    const rows = await db
      .select({
        invoice: invoices,
        order: orders,
      })
      .from(invoices)
      .innerJoin(orders, eq(invoices.orderId, orders.id))
      .orderBy(desc(invoices.issuedAt))
      .limit(limit);

    const items: InvoiceRow[] = rows.map((r) => ({
      invoiceId: r.invoice.id,
      invoiceNo: r.invoice.invoiceNo,
      orderId: r.order.id,
      orderNo: r.order.orderNo,
      fy: r.invoice.fy,
      issuedAt: r.invoice.issuedAt.toISOString(),
      totalMinor: r.invoice.totalMinor,
      taxMinor: r.invoice.taxMinor,
      currency: r.invoice.currency,
      buyer: {
        name: r.invoice.buyerSnapshot.name,
        email: r.invoice.buyerSnapshot.email,
        company: r.invoice.buyerSnapshot.company,
      },
      creditNotes: [],
      pdfMediaId: r.invoice.pdfMediaId,
    }));

    return { items, nextCursor: null };
  }

  // -- API-COM-13 listMyInvoices -----------------------------------------------------------------

  async listMyInvoices(
    ctx: RequestContext,
    input: ListMyInvoicesInput,
  ): Promise<{ items: InvoiceRow[]; nextCursor: string | null }> {
    const db = await getDb();

    const limit = input.limit ?? 25;
    const rows = await db
      .select({
        invoice: invoices,
        order: orders,
      })
      .from(invoices)
      .innerJoin(orders, eq(invoices.orderId, orders.id))
      .where(eq(orders.userId, ctx.userId))
      .orderBy(desc(invoices.issuedAt))
      .limit(limit);

    const items: InvoiceRow[] = rows.map((r) => ({
      invoiceId: r.invoice.id,
      invoiceNo: r.invoice.invoiceNo,
      orderId: r.order.id,
      orderNo: r.order.orderNo,
      fy: r.invoice.fy,
      issuedAt: r.invoice.issuedAt.toISOString(),
      totalMinor: r.invoice.totalMinor,
      taxMinor: r.invoice.taxMinor,
      currency: r.invoice.currency,
      buyer: {
        name: r.invoice.buyerSnapshot.name,
        email: r.invoice.buyerSnapshot.email,
        company: r.invoice.buyerSnapshot.company,
      },
      creditNotes: [],
      pdfMediaId: r.invoice.pdfMediaId,
    }));

    return { items, nextCursor: null };
  }

  // -- internal helpers --------------------------------------------------------------------------

  async nextInvoiceNumber(fy: string, tx: TxCtx): Promise<SequenceAllocation> {
    return await nextInvoiceNumber(fy, tx);
  }

  async nextCreditNoteNumber(fy: string, tx: TxCtx): Promise<SequenceAllocation> {
    return await nextCreditNoteNumber(fy, tx);
  }

  async renderInvoicePdf(invoiceId: string, tx: TxCtx): Promise<{ pdfMediaId: string }> {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
    }

    if (invoice.pdfMediaId) {
      return { pdfMediaId: invoice.pdfMediaId };
    }

    const objectKey = `invoices/${invoice.fy}/${invoice.invoiceNo.replace(/\//g, "-")}.pdf`;
    const lines = [
      `Invoice Number: ${invoice.invoiceNo}`,
      `Date: ${invoice.issuedAt.toISOString()}`,
      `Seller: ${invoice.sellerSnapshot.name}`,
      `Buyer: ${invoice.buyerSnapshot.name}`,
      `Total: ${invoice.currency} ${(invoice.totalMinor / 100).toFixed(2)}`,
    ];
    const pdfBuf = buildPdfBuffer(`Tax Invoice - ${invoice.invoiceNo}`, lines);

    await uploadDocumentPdf(objectKey, pdfBuf);

    const checksum = crypto.createHash("sha256").update(pdfBuf).digest("hex");
    const bucket = getDocumentsBucketName();

    // Check if media row already exists for this objectKey
    const [existingMedia] = await tx
      .select({ id: media.id })
      .from(media)
      .where(eq(media.objectKey, objectKey))
      .limit(1);

    let mediaId = existingMedia?.id;
    if (!mediaId) {
      const [mediaRow] = await tx
        .insert(media)
        .values({
          bucket,
          objectKey,
          mime: "application/pdf",
          sizeBytes: pdfBuf.length,
          checksum,
          visibility: "private",
          uploadedBy: invoice.sellerSnapshot.adminUserId as string || (await this.getFallbackAdminId(tx)),
        })
        .returning();
      mediaId = mediaRow!.id;
    }

    await tx
      .update(invoices)
      .set({ pdfMediaId: mediaId })
      .where(eq(invoices.id, invoice.id));

    return { pdfMediaId: mediaId };
  }

  async renderCreditNotePdf(creditNoteId: string, tx: TxCtx): Promise<{ pdfMediaId: string }> {
    const [cn] = await tx
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, creditNoteId))
      .limit(1);

    if (!cn) {
      throw new AppError(ErrorCode.NOT_FOUND, "Credit note not found");
    }

    if (cn.pdfMediaId) {
      return { pdfMediaId: cn.pdfMediaId };
    }

    const objectKey = `credit_notes/${cn.fy}/${cn.creditNo.replace(/\//g, "-")}.pdf`;
    const lines = [
      `Credit Note: ${cn.creditNo}`,
      `Date: ${cn.issuedAt.toISOString()}`,
      `Amount: ${cn.currency} ${(cn.amountMinor / 100).toFixed(2)}`,
    ];
    const pdfBuf = buildPdfBuffer(`Credit Note - ${cn.creditNo}`, lines);

    await uploadDocumentPdf(objectKey, pdfBuf);

    const checksum = crypto.createHash("sha256").update(pdfBuf).digest("hex");
    const bucket = getDocumentsBucketName();

    const [existingMedia] = await tx
      .select({ id: media.id })
      .from(media)
      .where(eq(media.objectKey, objectKey))
      .limit(1);

    let mediaId = existingMedia?.id;
    if (!mediaId) {
      const [mediaRow] = await tx
        .insert(media)
        .values({
          bucket,
          objectKey,
          mime: "application/pdf",
          sizeBytes: pdfBuf.length,
          checksum,
          visibility: "private",
          uploadedBy: await this.getFallbackAdminId(tx),
        })
        .returning();
      mediaId = mediaRow!.id;
    }

    await tx
      .update(creditNotes)
      .set({ pdfMediaId: mediaId })
      .where(eq(creditNotes.id, cn.id));

    return { pdfMediaId: mediaId };
  }

  async regeneratePending(now: Date = new Date()): Promise<{ count: number }> {
    const db = await getDb();
    const pendingInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(sql`${invoices.pdfMediaId} IS NULL`);

    let count = 0;
    for (const inv of pendingInvoices) {
      await withTx(async (tx) => {
        await this.renderInvoicePdf(inv.id, tx);
      });
      count++;
    }
    return { count };
  }

  private async getFallbackAdminId(tx: TxCtx): Promise<string> {
    const { users } = await import("../../../drizzle/schema/auth");
    const [user] = await tx.select({ id: users.id }).from(users).limit(1);
    return user?.id ?? "00000000-0000-0000-0000-000000000000";
  }
}

export const invoicesService: InvoicesService = new DefaultInvoicesService();

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
    regeneratePending: "async",
  });
}
