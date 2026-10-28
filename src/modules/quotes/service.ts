/**
 * Custom quotes service implementation (docs/06 §2.3 API-COM-09, API-COM-10; D-520; MASTER_SPEC §7).
 */
import { and, desc, eq, ilike, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb, withTx, type TxCtx } from "@/lib/db";
import { customQuotes, type CustomQuote } from "../../../drizzle/schema/commerce";
import { orders, orderItems } from "../../../drizzle/schema/commerce";
import { offerings } from "../../../drizzle/schema/offerings";
import { productOwnerships } from "../../../drizzle/schema/ownership";
import { emailOutbox, notifications } from "../../../drizzle/schema/notifications";
import { users } from "../../../drizzle/schema/auth";
import { assertEmailVerified } from "@/modules/auth/verified";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { Context, RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { ListResult } from "@/modules/_shared/zod";
import type { CreateOrderResult } from "@/modules/orders/types";
import { nextOrderNo } from "@/modules/orders/numbering";
import type { Currency } from "@/lib/money";
import { fxService } from "@/modules/fx/service";
import { paymentsService } from "@/modules/payments/service";
import { quotePayUrl } from "@/lib/routes";
import { generateQuoteToken } from "./token";
import type { QuotesService } from "./contracts";
import type {
  AcceptCustomQuoteInput,
  CancelCustomQuoteInput,
  CreateCustomQuoteInput,
  CreateQuoteResult,
  GetQuoteInput,
  RejectCustomQuoteInput,
  SearchCustomersInput,
  ListQuotesInput,
  QuoteView,
  SendCustomQuoteInput,
} from "./types";

/** Tax on a tax-exclusive amount, rounded to the nearest minor unit. */
function taxOf(amountMinor: number, taxBps: number): number {
  return Math.round((amountMinor * taxBps) / 10000);
}

export class DefaultQuotesService implements QuotesService {
  // -- API-COM-09 createCustomQuote --------------------------------------------------------------

  async createCustomQuote(
    ctx: RequestContext,
    input: CreateCustomQuoteInput,
    outerTx?: TxCtx,
  ): Promise<CreateQuoteResult> {
    assertPermission(ctx, "orders.manual.write");

    const runner = async (tx: TxCtx): Promise<CreateQuoteResult> => {
      // Validate customer exists
      const [customer] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.customerId))
        .limit(1);

      if (!customer) {
        throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
      }

      // If offeringId provided, validate it exists
      if (input.offeringId) {
        const [offering] = await tx
          .select({ id: offerings.id })
          .from(offerings)
          .where(eq(offerings.id, input.offeringId))
          .limit(1);

        if (!offering) {
          throw new AppError(ErrorCode.NOT_FOUND, "Offering not found");
        }
      }

      const lineItems = input.lineItems ?? null;
      const lineSum = lineItems
        ? lineItems.reduce((n, l) => n + l.quantity * l.unitMinor, 0)
        : null;
      if (lineSum !== null && input.amountMinor !== undefined && input.amountMinor !== lineSum) {
        throw new AppError(ErrorCode.VALIDATION, "Amount must equal the sum of the line items");
      }
      const amountMinor = lineSum ?? input.amountMinor;
      if (amountMinor === undefined || amountMinor <= 0) {
        throw new AppError(ErrorCode.VALIDATION, "Enter an amount or add at least one line item");
      }
      const token = generateQuoteToken();
      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

      const [newQuote] = await tx
        .insert(customQuotes)
        .values({
          customerId: input.customerId,
          offeringId: input.offeringId ?? null,
          title: input.title,
          description: input.description ?? null,
          currency: input.currency,
          amountMinor,
          lineItems,
          taxBps: input.taxBps ?? 0,
          internalNote: input.internalNote ?? null,
          token,
          expiresAt,
          status: "draft",
          createdBy: ctx.userId,
        })
        .returning();
      if (!newQuote) throw new AppError(ErrorCode.INTERNAL, "Write returned no row");

      await auditService.log(
        ctx,
        "quote.created",
        { type: "custom_quote", id: newQuote.id },
        null,
        newQuote,
        tx,
      );

      return {
        quoteId: newQuote.id,
        token,
        payUrl: quotePayUrl(token),
      };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  // -- API-COM-09 sendCustomQuote ----------------------------------------------------------------

  async sendCustomQuote(
    ctx: RequestContext,
    input: SendCustomQuoteInput,
    outerTx?: TxCtx,
  ): Promise<{ quote: CustomQuote }> {
    assertPermission(ctx, "orders.manual.write");

    const runner = async (tx: TxCtx): Promise<{ quote: CustomQuote }> => {
      const [quote] = await tx
        .select()
        .from(customQuotes)
        .where(eq(customQuotes.id, input.quoteId))
        .limit(1);

      if (!quote) {
        throw new AppError(ErrorCode.NOT_FOUND, "Custom quote not found");
      }

      // draft -> sent; sent/viewed -> resend (same token, customer is re-notified).
      const isResend =
        quote.status === "sent" || quote.status === "viewed" || quote.status === "expired";
      if (quote.status !== "draft" && !isResend) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot send a quote in status '${quote.status}'`,
        );
      }
      const newExpiry = input.expiresAt ? new Date(input.expiresAt) : quote.expiresAt;
      if (newExpiry && newExpiry.getTime() <= Date.now()) {
        throw new AppError(
          ErrorCode.VALIDATION,
          "This quote's validity date has passed - pick a new validity date to send it",
        );
      }

      const now = new Date();
      const [updatedQuote] = await tx
        .update(customQuotes)
        .set({
          status: quote.status === "viewed" ? "viewed" : "sent",
          sentAt: now,
          expiresAt: newExpiry,
        })
        .where(eq(customQuotes.id, quote.id))
        .returning();
      if (!updatedQuote) throw new AppError(ErrorCode.INTERNAL, "Write returned no row");

      const [customer] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, quote.customerId))
        .limit(1);

      const payUrl = quotePayUrl(quote.token);
      const totalMinor = quote.amountMinor + taxOf(quote.amountMinor, quote.taxBps);

      await tx.insert(notifications).values({
        userId: quote.customerId,
        type: "quote.sent",
        title: isResend ? "Reminder: custom quote awaiting you" : "New custom quote received",
        body: `You received a custom quote: ${quote.title}`,
        link: `/quote/${quote.token}`,
        payload: { quoteId: quote.id, amountMinor: totalMinor, currency: quote.currency },
      });

      if (customer?.email) {
        await tx.insert(emailOutbox).values({
          toEmail: customer.email,
          template: "custom-quote",
          payload: {
            quoteId: quote.id,
            title: quote.title,
            amount: (totalMinor / 100).toFixed(2),
            currency: quote.currency,
            validUntil: newExpiry ? newExpiry.toISOString().slice(0, 10) : null,
            resend: isResend,
            payUrl,
          },
          priority: 1,
        });
      }

      await auditService.log(
        ctx,
        isResend ? "quote.resent" : "quote.sent",
        { type: "custom_quote", id: quote.id },
        quote,
        updatedQuote,
        tx,
      );

      return { quote: updatedQuote };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  // -- API-COM-09 cancelCustomQuote --------------------------------------------------------------

  async cancelCustomQuote(
    ctx: RequestContext,
    input: CancelCustomQuoteInput,
    outerTx?: TxCtx,
  ): Promise<{ quote: CustomQuote }> {
    assertPermission(ctx, "orders.manual.write");

    const runner = async (tx: TxCtx): Promise<{ quote: CustomQuote }> => {
      const [quote] = await tx
        .select()
        .from(customQuotes)
        .where(eq(customQuotes.id, input.quoteId))
        .limit(1);

      if (!quote) {
        throw new AppError(ErrorCode.NOT_FOUND, "Custom quote not found");
      }

      if (quote.status === "paid" || quote.status === "cancelled" || quote.status === "rejected") {
        throw new AppError(ErrorCode.STATE_INVALID, `Cannot cancel a ${quote.status} quote`);
      }

      const [updatedQuote] = await tx
        .update(customQuotes)
        .set({ status: "cancelled" })
        .where(eq(customQuotes.id, quote.id))
        .returning();
      if (!updatedQuote) throw new AppError(ErrorCode.INTERNAL, "Write returned no row");

      // If there was an associated pending order, cancel it
      if (quote.orderId) {
        const [associatedOrder] = await tx
          .select({ status: orders.status })
          .from(orders)
          .where(eq(orders.id, quote.orderId))
          .limit(1);

        if (associatedOrder?.status === "pending_payment") {
          await tx
            .update(orders)
            .set({ status: "cancelled", cancelledAt: new Date() })
            .where(eq(orders.id, quote.orderId));
        }
      }

      await auditService.log(
        ctx,
        "quote.cancelled",
        { type: "custom_quote", id: quote.id },
        quote,
        updatedQuote,
        tx,
      );

      return { quote: updatedQuote };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  // -- listQuotes --------------------------------------------------------------------------------

  async listQuotes(ctx: RequestContext, input: ListQuotesInput): Promise<ListResult<CustomQuote>> {
    assertPermission(ctx, "orders.read");
    const db = await getDb();

    const limit = input.limit ?? 25;
    const conditions = [];

    if (input.filters?.status) {
      conditions.push(eq(customQuotes.status, input.filters.status));
    }
    if (input.filters?.customerId) {
      conditions.push(eq(customQuotes.customerId, input.filters.customerId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(customQuotes)
      .where(whereClause)
      .orderBy(desc(customQuotes.createdAt))
      .limit(limit);

    return {
      items,
      nextCursor: null,
    };
  }

  // -- API-COM-10 getQuote -----------------------------------------------------------------------

  async getQuote(ctx: Context, input: GetQuoteInput): Promise<QuoteView> {
    const db = await getDb();

    const [quote] = await db
      .select()
      .from(customQuotes)
      .where(eq(customQuotes.token, input.token))
      .limit(1);

    if (!quote) {
      throw new AppError(ErrorCode.NOT_FOUND, "Quote not found");
    }

    const isCustomer = ctx.userId !== null && ctx.userId === quote.customerId;
    const isExpired = quote.expiresAt !== null && quote.expiresAt < new Date();
    const open = quote.status === "sent" || quote.status === "viewed";
    let status = quote.status;
    if (open && isExpired) {
      status = "expired";
    } else if (isCustomer && quote.status === "sent") {
      // First time the invited customer opens the link: sent -> viewed.
      await db
        .update(customQuotes)
        .set({ status: "viewed", viewedAt: new Date() })
        .where(and(eq(customQuotes.id, quote.id), eq(customQuotes.status, "sent")));
      status = "viewed";
    }
    const canAccept =
      isCustomer && (status === "sent" || status === "viewed") && quote.orderId === null;

    return {
      quote: {
        id: quote.id,
        title: quote.title,
        description: quote.description,
        currency: quote.currency,
        amountMinor: quote.amountMinor,
        status,
        expiresAt: quote.expiresAt,
        orderId: quote.orderId,
        taxBps: quote.taxBps,
        lineItems: quote.lineItems,
      },
      canAccept,
    };
  }

  // -- reject (customer) -------------------------------------------------------------------------

  async rejectCustomQuote(
    ctx: RequestContext,
    input: RejectCustomQuoteInput,
    outerTx?: TxCtx,
  ): Promise<{ quote: CustomQuote }> {
    const runner = async (tx: TxCtx): Promise<{ quote: CustomQuote }> => {
      const [quote] = await tx
        .select()
        .from(customQuotes)
        .where(eq(customQuotes.token, input.token))
        .limit(1);
      if (!quote) throw new AppError(ErrorCode.NOT_FOUND, "Quote not found");
      if (ctx.userId !== quote.customerId) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          "Only the invited customer account can reject this quote",
        );
      }
      if (quote.status !== "sent" && quote.status !== "viewed") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot reject quote in status '${quote.status}'`,
        );
      }
      const [updated] = await tx
        .update(customQuotes)
        .set({ status: "rejected", rejectedAt: new Date() })
        .where(eq(customQuotes.id, quote.id))
        .returning();
      if (!updated) throw new AppError(ErrorCode.INTERNAL, "Write returned no row");
      await auditService.log(
        ctx,
        "quote.rejected",
        { type: "custom_quote", id: quote.id },
        quote,
        { status: "rejected", reason: input.reason ?? null },
        tx,
      );
      return { quote: updated };
    };
    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  async listMyQuotes(ctx: RequestContext): Promise<CustomQuote[]> {
    // `commerce.self` is enforced by the action layer; rows are scoped to ctx.userId here.
    if (!ctx.userId) return [];
    const db = await getDb();
    const rows = await db
      .select()
      .from(customQuotes)
      .where(eq(customQuotes.customerId, ctx.userId))
      .orderBy(desc(customQuotes.createdAt))
      .limit(100);
    const now = new Date();
    return rows
      .filter((q) => q.status !== "draft")
      .map((q) =>
        (q.status === "sent" || q.status === "viewed") && q.expiresAt && q.expiresAt < now
          ? { ...q, status: "expired" as const }
          : q,
      );
  }

  // -- admin customer search ---------------------------------------------------------------------

  async searchCustomers(
    ctx: RequestContext,
    input: SearchCustomersInput,
  ): Promise<Array<{ id: string; name: string; email: string }>> {
    assertPermission(ctx, "customers.read");
    const db = await getDb();
    const needle = `%${input.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const where = input.q
      ? and(isNull(users.deletedAt), or(ilike(users.name, needle), ilike(users.email, needle)))
      : isNull(users.deletedAt);
    return await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(20);
  }

  // -- API-COM-10 acceptCustomQuote --------------------------------------------------------------

  async acceptCustomQuote(
    ctx: RequestContext,
    input: AcceptCustomQuoteInput,
    outerTx?: TxCtx,
  ): Promise<CreateOrderResult> {
    const runner = async (tx: TxCtx): Promise<CreateOrderResult> => {
      const [quote] = await tx
        .select()
        .from(customQuotes)
        .where(eq(customQuotes.token, input.token))
        .limit(1);

      if (!quote) {
        throw new AppError(ErrorCode.NOT_FOUND, "Quote not found");
      }

      // Foreign customer check: only the designated customer can accept
      if (ctx.userId !== quote.customerId) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          "Only the invited customer account can accept this quote",
        );
      }

      if (quote.status !== "sent" && quote.status !== "viewed") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot accept quote in status '${quote.status}'`,
        );
      }

      // R8-08: accepting a quote creates an order -- same verified-email gate as checkout.
      await assertEmailVerified(ctx, tx, "Please verify your email before accepting this quote");

      if (quote.expiresAt !== null && quote.expiresAt < new Date()) {
        throw new AppError(ErrorCode.ORDER_EXPIRED, "Custom quote has expired");
      }

      // Allocate order number
      const orderNo = await nextOrderNo(tx);

      // Determine product & ownership if quote has offeringId
      let productId: string | null = null;
      let ownershipId: string | null = null;

      if (quote.offeringId) {
        const [offering] = await tx
          .select({ productId: offerings.productId })
          .from(offerings)
          .where(eq(offerings.id, quote.offeringId))
          .limit(1);

        if (offering) {
          productId = offering.productId;
          const [ownership] = await tx
            .select({ id: productOwnerships.id })
            .from(productOwnerships)
            .where(
              and(
                eq(productOwnerships.productId, productId),
                eq(productOwnerships.status, "active"),
              ),
            )
            .limit(1);
          ownershipId = ownership?.id ?? null;
        }
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const taxMinor = taxOf(quote.amountMinor, quote.taxBps);

      // Create Order
      const [order] = await tx
        .insert(orders)
        .values({
          orderNo,
          type: "product",
          userId: ctx.userId,
          status: "pending_payment",
          currency: quote.currency,
          subtotalMinor: quote.amountMinor,
          discountMinor: 0,
          taxMinor,
          totalMinor: quote.amountMinor + taxMinor,
          customQuoteId: quote.id,
          billingSnapshot: {
            name: input.billing.name,
            email: input.billing.email,
            country: input.billing.country,
            company: input.billing.company ?? null,
            address: input.billing.address ?? null,
            gst_number: input.billing.gstNumber ?? null,
          },
          taxRateBps: quote.taxBps,
          fxRateToInr:
            quote.currency === "INR"
              ? "1.00000000"
              : await fxService.rateToInrOn(quote.currency as Currency, new Date(), tx),
          expiresAt,
        })
        .returning();
      if (!order) throw new AppError(ErrorCode.INTERNAL, "Write returned no row");

      // Order items: itemised lines when present (tax on the first line absorbs rounding so the
      // lines add up to the order tax), otherwise a single line for the whole quote.
      const lines =
        quote.lineItems && quote.lineItems.length > 0
          ? quote.lineItems
          : [{ description: quote.title, quantity: 1, unitMinor: quote.amountMinor }];
      let taxLeft = taxMinor;
      for (const [i, line] of lines.entries()) {
        const lineNet = line.quantity * line.unitMinor;
        const lineTax =
          i === lines.length - 1 ? taxLeft : Math.min(taxLeft, taxOf(lineNet, quote.taxBps));
        taxLeft -= lineTax;
        await tx.insert(orderItems).values({
          orderId: order.id,
          offeringId: quote.offeringId ?? null,
          productId,
          description: line.description,
          quantity: line.quantity,
          unitMinor: line.unitMinor,
          discountMinor: 0,
          taxMinor: lineTax,
          totalMinor: lineNet + lineTax,
          ownershipId,
        });
      }

      // Update quote status to accepted and link order
      await tx
        .update(customQuotes)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          orderId: order.id,
        })
        .where(eq(customQuotes.id, quote.id));

      // Create payment intent
      const paymentIntent = await paymentsService.createIntentForOrder(
        order.id,
        input.paymentMethod,
        tx,
      );

      await auditService.log(
        ctx,
        "quote.accepted",
        { type: "custom_quote", id: quote.id },
        quote,
        { status: "accepted", orderId: order.id },
        tx,
      );

      return {
        orderId: order.id,
        orderNo: order.orderNo,
        payment: {
          paymentId: paymentIntent.paymentId,
          method: input.paymentMethod,
          instructions: paymentIntent.instructions,
        },
        expiresAt: order.expiresAt
          ? order.expiresAt.toISOString()
          : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  // -- markPaid ----------------------------------------------------------------------------------

  async markPaid(quoteId: string, tx: TxCtx): Promise<void> {
    await tx.update(customQuotes).set({ status: "paid" }).where(eq(customQuotes.id, quoteId));
  }

  // -- expireQuotes ------------------------------------------------------------------------------

  async expireQuotes(
    now: Date = new Date(),
    outerTx?: TxCtx,
  ): Promise<{ expiredQuoteIds: string[] }> {
    const runner = async (tx: TxCtx): Promise<{ expiredQuoteIds: string[] }> => {
      // Find all quotes where status is 'sent' and expiresAt <= now and no order created
      const quotesToExpire = await tx
        .select({ id: customQuotes.id })
        .from(customQuotes)
        .where(
          and(
            inArray(customQuotes.status, ["sent", "viewed"]),
            lte(customQuotes.expiresAt, now),
            isNull(customQuotes.orderId),
          ),
        );

      const expiredQuoteIds: string[] = [];

      for (const q of quotesToExpire) {
        await tx.update(customQuotes).set({ status: "expired" }).where(eq(customQuotes.id, q.id));
        expiredQuoteIds.push(q.id);
      }

      return { expiredQuoteIds };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }
}

export const quotesService: QuotesService = new DefaultQuotesService();

export function createNotImplementedQuotesService(): QuotesService {
  return createNotImplemented<QuotesService>("quotes", "P4", {
    createCustomQuote: "async",
    sendCustomQuote: "async",
    cancelCustomQuote: "async",
    listQuotes: "async",
    getQuote: "async",
    acceptCustomQuote: "async",
    rejectCustomQuote: "async",
    searchCustomers: "async",
    listMyQuotes: "async",
    markPaid: "async",
    expireQuotes: "async",
  });
}
