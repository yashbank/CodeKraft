/**
 * Custom quotes service implementation (docs/06 §2.3 API-COM-09, API-COM-10; D-520; MASTER_SPEC §7).
 */
import { and, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { db, getDb, withTx, type TxCtx } from "@/lib/db";
import { customQuotes, type CustomQuote } from "../../../drizzle/schema/commerce";
import { orders, orderItems } from "../../../drizzle/schema/commerce";
import { offerings } from "../../../drizzle/schema/offerings";
import { productOwnerships } from "../../../drizzle/schema/ownership";
import { emailOutbox, notifications } from "../../../drizzle/schema/notifications";
import { users } from "../../../drizzle/schema/auth";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { Context, RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { ListResult } from "@/modules/_shared/zod";
import type { CreateOrderResult } from "@/modules/orders/types";
import { nextOrderNo } from "@/modules/orders/numbering";
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
  ListQuotesInput,
  QuoteView,
  SendCustomQuoteInput,
} from "./types";

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
          amountMinor: input.amountMinor,
          token,
          expiresAt,
          status: "draft",
          createdBy: ctx.userId,
        })
        .returning();

      await auditService.log(
        ctx,
        "quote.created",
        { type: "custom_quote", id: newQuote!.id },
        null,
        newQuote,
        tx,
      );

      return {
        quoteId: newQuote!.id,
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

      if (quote.status !== "draft") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot send quote in status '${quote.status}'`,
        );
      }

      const [updatedQuote] = await tx
        .update(customQuotes)
        .set({ status: "sent" })
        .where(eq(customQuotes.id, quote.id))
        .returning();

      // Get customer email
      const [customer] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, quote.customerId))
        .limit(1);

      const payUrl = quotePayUrl(quote.token);

      // Notification
      await tx.insert(notifications).values({
        userId: quote.customerId,
        type: "quote.sent",
        title: "New custom quote received",
        body: `You received a custom quote: ${quote.title}`,
        link: `/quote/${quote.token}`,
        payload: { quoteId: quote.id, amountMinor: quote.amountMinor, currency: quote.currency },
      });

      // Email outbox
      if (customer?.email) {
        await tx.insert(emailOutbox).values({
          toEmail: customer.email,
          template: "custom-quote",
          payload: {
            quoteId: quote.id,
            title: quote.title,
            amount: (quote.amountMinor / 100).toFixed(2),
            currency: quote.currency,
            payUrl,
          },
          priority: 1,
        });
      }

      await auditService.log(
        ctx,
        "quote.sent",
        { type: "custom_quote", id: quote.id },
        quote,
        updatedQuote,
        tx,
      );

      return { quote: updatedQuote! };
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

      if (quote.status === "paid") {
        throw new AppError(ErrorCode.STATE_INVALID, "Cannot cancel a paid quote");
      }

      const [updatedQuote] = await tx
        .update(customQuotes)
        .set({ status: "cancelled" })
        .where(eq(customQuotes.id, quote.id))
        .returning();

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

      return { quote: updatedQuote! };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  // -- listQuotes --------------------------------------------------------------------------------

  async listQuotes(
    ctx: RequestContext,
    input: ListQuotesInput,
  ): Promise<ListResult<CustomQuote>> {
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
    const canAccept =
      isCustomer && quote.status === "sent" && !isExpired && quote.orderId === null;

    return {
      quote: {
        id: quote.id,
        title: quote.title,
        description: quote.description,
        currency: quote.currency,
        amountMinor: quote.amountMinor,
        status: quote.status,
        expiresAt: quote.expiresAt,
        orderId: quote.orderId,
      },
      canAccept,
    };
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

      if (quote.status !== "sent") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot accept quote in status '${quote.status}'`,
        );
      }

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
          taxMinor: 0,
          totalMinor: quote.amountMinor,
          customQuoteId: quote.id,
          billingSnapshot: {
            name: input.billing.name,
            email: input.billing.email,
            country: input.billing.country,
            company: input.billing.company ?? null,
            address: input.billing.address ?? null,
            gst_number: input.billing.gstNumber ?? null,
          },
          taxRateBps: 0,
          fxRateToInr: "1.00000000",
          expiresAt,
        })
        .returning();

      // Create Order Item
      await tx.insert(orderItems).values({
        orderId: order!.id,
        offeringId: quote.offeringId ?? null,
        productId,
        description: quote.title,
        quantity: 1,
        unitMinor: quote.amountMinor,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: quote.amountMinor,
        ownershipId,
      });

      // Update quote status to accepted and link order
      await tx
        .update(customQuotes)
        .set({
          status: "accepted",
          orderId: order!.id,
        })
        .where(eq(customQuotes.id, quote.id));

      // Create payment intent
      const paymentIntent = await paymentsService.createIntentForOrder(
        order!.id,
        input.paymentMethod,
        tx,
      );

      await auditService.log(
        ctx,
        "quote.accepted",
        { type: "custom_quote", id: quote.id },
        quote,
        { status: "accepted", orderId: order!.id },
        tx,
      );

      return {
        orderId: order!.id,
        orderNo: order!.orderNo,
        payment: {
          paymentId: paymentIntent.paymentId,
          method: input.paymentMethod,
          instructions: paymentIntent.instructions,
        },
        expiresAt: order!.expiresAt
          ? order!.expiresAt.toISOString()
          : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  // -- markPaid ----------------------------------------------------------------------------------

  async markPaid(quoteId: string, tx: TxCtx): Promise<void> {
    await tx
      .update(customQuotes)
      .set({ status: "paid" })
      .where(eq(customQuotes.id, quoteId));
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
            eq(customQuotes.status, "sent"),
            lte(customQuotes.expiresAt, now),
            isNull(customQuotes.orderId),
          ),
        );

      const expiredQuoteIds: string[] = [];

      for (const q of quotesToExpire) {
        await tx
          .update(customQuotes)
          .set({ status: "expired" })
          .where(eq(customQuotes.id, q.id));
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
    markPaid: "async",
    expireQuotes: "async",
  });
}
