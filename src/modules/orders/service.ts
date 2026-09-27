/**
 * Orders service implementation (docs/06 API-COM-01..07, API-COM-14, master plan §5).
 */
import { and, desc, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission, can } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { type Currency, money } from "@/lib/money";

function findPriceIn(prices: { currency: string; amountMinor: number }[], currency: Currency) {
  const match = prices.find((p) => p.currency === currency);
  if (!match) {
    throw new AppError(ErrorCode.VALIDATION, `Price not found for currency ${currency}`);
  }
  return match;
}
import { settingsService } from "@/modules/settings/service";
import { effectiveTaxRateBps } from "@/modules/settings/tax";
import { fxService } from "@/modules/fx/service";
import { ownershipService } from "@/modules/ownership/service";
import { couponsService } from "@/modules/coupons/service";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import {
  type Order,
  type OrderItem,
  type OrderStatus,
  type Payment,
  coupons,
  customQuotes,
  orderItems,
  orders,
  payments,
  refunds,
  userOfferingPurchases,
} from "../../../drizzle/schema/commerce";
import { offerings, offeringPrices, offeringPaymentMethods } from "../../../drizzle/schema/offerings";
import { products } from "../../../drizzle/schema/catalog";
import { users } from "../../../drizzle/schema/auth";
import { customerProfiles } from "../../../drizzle/schema/users-ext";
import { emailOutbox, notifications } from "../../../drizzle/schema/notifications";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { creditNotes, invoices } from "../../../drizzle/schema/invoices";
import { nextOrderNo } from "./numbering";
import { createManualOrder } from "./manual";
import { applyProjectOrderSplit } from "./project-split";
import { assertCanTransitionOrder, markFulfilledIfComplete } from "./state";
import { calculateItemPricing, calculateOrderTotals } from "./totals";
import { expirePendingOrders } from "./expiry";
import type { OrdersService } from "./contracts";
import type {
  CancelMyOrderInput,
  CheckoutPreview,
  CreateManualOrderInput,
  CreateManualOrderResult,
  CreateOrderInput,
  CreateOrderResult,
  ExpireOrdersResult,
  GetMyOrderInput,
  GetOrderAdminInput,
  ListMyOrdersInput,
  ListOrdersAdminInput,
  ListResult,
  ManualPaymentMethod,
  OrderAdminRow,
  OrderDetail,
  OrderPaymentHandle,
  OrderPaymentView,
  OrderSummary,
  PreviewCheckoutInput,
  ProjectOrderSplitPayload,
  RetryPaymentInput,
} from "./types";

async function getDatabase(tx?: DbOrTx): Promise<DbOrTx> {
  if (tx) return tx;
  const { db } = await import("@/lib/db");
  return db;
}

export class DefaultOrdersService implements OrdersService {
  private readonly fallback = createNotImplementedOrdersService();

  // -- API-COM-01 previewCheckout -----------------------------------------------------------------

  async previewCheckout(
    ctx: RequestContext,
    input: PreviewCheckoutInput,
  ): Promise<CheckoutPreview> {
    const db = await getDatabase();

    // 1. Load offering + product
    const [offering] = await db
      .select()
      .from(offerings)
      .where(eq(offerings.id, input.offeringId))
      .limit(1);

    if (!offering || offering.status !== "active") {
      throw new AppError(ErrorCode.NOT_FOUND, "Offering not found or not active");
    }

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, offering.productId))
      .limit(1);

    if (!product || product.status !== "published" || product.isComingSoon) {
      throw new AppError(ErrorCode.NOT_FOUND, "Product not available for checkout");
    }

    if (offering.purchaseModel === "custom_quote") {
      throw new AppError(ErrorCode.STATE_INVALID, "Custom quote offerings cannot be checked out directly");
    }

    // 2. BR-10 duplicate purchase check
    const warnings: string[] = [];
    if (offering.purchaseModel === "one_time") {
      const [existingPurchase] = await db
        .select()
        .from(userOfferingPurchases)
        .where(
          and(
            eq(userOfferingPurchases.userId, ctx.userId),
            eq(userOfferingPurchases.offeringId, offering.id),
          ),
        )
        .limit(1);

      if (existingPurchase) {
        throw new AppError(
          ErrorCode.DUPLICATE_PURCHASE,
          "You have already purchased this offering (one-time license)",
        );
      }
    }

    // 3. Load prices for offering
    const prices = await db
      .select()
      .from(offeringPrices)
      .where(eq(offeringPrices.offeringId, offering.id));

    const basePrice = findPriceIn(prices, "INR");
    const unitMinor = basePrice.amountMinor;

    // 4. Load settings for tax rate and GSTIN
    const settings = await settingsService.load(db);
    const taxRateBps = effectiveTaxRateBps(product, settings);

    // 5. Calculate line totals (with coupon if provided)
    let discountMinor = 0;
    let couponInfo: CheckoutPreview["coupon"] | undefined = undefined;
    if (input.couponCode) {
      const validation = await couponsService.validateForOrder({
        code: input.couponCode,
        userId: ctx.userId ?? null,
        productId: product.id,
        subtotal: money(unitMinor, "INR"),
      });
      if (validation.valid) {
        discountMinor = validation.discountMinor;
        couponInfo = {
          code: validation.coupon.code,
          kind: validation.coupon.kind,
          value: validation.coupon.value,
        };
      } else {
        warnings.push(`Coupon rejected: ${validation.reason}`);
      }
    }

    const itemPricing = calculateItemPricing({
      unitMinor,
      quantity: 1,
      discountMinor,
      taxRateBps,
    });

    const subtotal = money(itemPricing.grossMinor, "INR");
    const discount = money(itemPricing.discountMinor, "INR");
    const tax = money(itemPricing.taxMinor, "INR");
    const total = money(itemPricing.totalMinor, "INR");

    // 6. Display total in user currency if different from INR
    const displayTotal = total;

    // 7. Enabled payment methods
    const methodRows = await db
      .select()
      .from(offeringPaymentMethods)
      .where(eq(offeringPaymentMethods.offeringId, offering.id));

    const enabledMethods = methodRows.map((m) => m.method as ManualPaymentMethod);

    return {
      offering: {
        id: offering.id,
        title: offering.name,
        purchaseModel: offering.purchaseModel,
        deliveryType: offering.deliveryType,
      },
      product: {
        id: product.id,
        slug: product.slug,
        title: product.name,
        taxEnabled: product.taxEnabled,
        isRefundable: product.isRefundable,
      },
      lines: [
        {
          description: offering.name,
          unitMinor: itemPricing.unitMinor,
          quantity: 1,
          discountMinor: itemPricing.discountMinor,
          taxMinor: itemPricing.taxMinor,
          totalMinor: itemPricing.totalMinor,
        },
      ],
      subtotal,
      discount,
      tax,
      total,
      displayTotal,
      taxRateBps,
      coupon: couponInfo,
      enabledMethods,
      warnings,
    };
  }

  // -- API-COM-02 createOrder ---------------------------------------------------------------------

  async createOrder(
    ctx: RequestContext,
    input: CreateOrderInput,
    outerTx?: TxCtx,
  ): Promise<CreateOrderResult> {
    const runner = async (tx: TxCtx): Promise<CreateOrderResult> => {
      // 1. Check verified email
      const [user] = await tx
        .select({ id: users.id, emailVerified: users.emailVerified, email: users.email })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      if (!user || !user.emailVerified) {
        throw new AppError(ErrorCode.EMAIL_UNVERIFIED, "Email must be verified to place an order");
      }

      // 2. Load offering
      const [offering] = await tx
        .select()
        .from(offerings)
        .where(eq(offerings.id, input.offeringId))
        .limit(1);

      if (!offering || offering.status !== "active") {
        throw new AppError(ErrorCode.NOT_FOUND, "Offering not found or not active");
      }

      // 3. BR-10 duplicate check
      if (offering.purchaseModel === "one_time") {
        const [existing] = await tx
          .select()
          .from(userOfferingPurchases)
          .where(
            and(
              eq(userOfferingPurchases.userId, ctx.userId),
              eq(userOfferingPurchases.offeringId, offering.id),
            ),
          )
          .limit(1);

        if (existing) {
          throw new AppError(
            ErrorCode.DUPLICATE_PURCHASE,
            "You have already purchased this offering",
          );
        }
      }

      const now = new Date();

      // 4. Idempotency per (userId, offeringId) while pending_payment exists
      const [existingOrder] = await tx
        .select({
          id: orders.id,
          orderNo: orders.orderNo,
          expiresAt: orders.expiresAt,
        })
        .from(orders)
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .where(
          and(
            eq(orders.userId, ctx.userId),
            eq(orderItems.offeringId, input.offeringId),
            eq(orders.status, "pending_payment"),
            gt(orders.expiresAt, now),
          ),
        )
        .limit(1);

      if (existingOrder) {
        // Return existing order and open payment
        const [openPayment] = await tx
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.orderId, existingOrder.id),
              inArray(payments.status, ["initiated", "submitted"]),
            ),
          )
          .orderBy(desc(payments.createdAt))
          .limit(1);

        if (openPayment && openPayment.instructions) {
          return {
            orderId: existingOrder.id,
            orderNo: existingOrder.orderNo,
            payment: {
              paymentId: openPayment.id,
              method: openPayment.provider as ManualPaymentMethod,
              instructions: openPayment.instructions as any,
            },
            expiresAt: (existingOrder.expiresAt ?? now).toISOString(),
          };
        }
      }

      // 5. Pricing and active ownership
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, offering.productId))
        .limit(1);

      if (!product || product.status !== "published" || product.isComingSoon) {
        throw new AppError(ErrorCode.NOT_FOUND, "Product not available for order");
      }

      const prices = await tx
        .select()
        .from(offeringPrices)
        .where(eq(offeringPrices.offeringId, offering.id));

      const basePrice = findPriceIn(prices, "INR");
      const settings = await settingsService.load(tx);
      const taxRateBps = effectiveTaxRateBps(product, settings);

      let discountMinor = 0;
      let couponId: string | null = null;
      if (input.couponCode) {
        const validation = await couponsService.validateForOrder(
          {
            code: input.couponCode,
            userId: ctx.userId,
            productId: product.id,
            subtotal: money(basePrice.amountMinor, "INR"),
          },
          tx,
        );
        if (!validation.valid) {
          throw new AppError(ErrorCode.VALIDATION, `Invalid coupon code: ${validation.reason}`);
        }
        discountMinor = validation.discountMinor;
        couponId = validation.coupon.id;
      }

      const itemPricing = calculateItemPricing({
        unitMinor: basePrice.amountMinor,
        quantity: 1,
        discountMinor,
        taxRateBps,
      });

      const activeOwnership = await ownershipService.getActiveAt(product.id, now, tx);

      // 6. Generate order number and expiry (7 days)
      const orderNo = await nextOrderNo(tx);
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNo,
          userId: ctx.userId,
          couponId,
          type: "product",
          status: "pending_payment",
          currency: "INR",
          subtotalMinor: itemPricing.grossMinor,
          discountMinor: itemPricing.discountMinor,
          taxMinor: itemPricing.taxMinor,
          totalMinor: itemPricing.totalMinor,
          taxRateBps,
          billingSnapshot: input.billing,
          fxRateToInr: "1.00000000",
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // 7. Insert order item
      await tx.insert(orderItems).values({
        orderId: newOrder!.id,
        offeringId: offering.id,
        productId: product.id,
        description: offering.name,
        quantity: 1,
        unitMinor: itemPricing.unitMinor,
        discountMinor: itemPricing.discountMinor,
        taxMinor: itemPricing.taxMinor,
        totalMinor: itemPricing.totalMinor,
        ownershipId: activeOwnership?.id ?? null,
      });

      // 8. Generate payment instructions & insert payment via payments service
      const { paymentsService } = await import("@/modules/payments/service");
      const { paymentId, instructions } = await paymentsService.createIntentForOrder(
        newOrder!.id,
        input.paymentMethod as any,
        tx,
      );

      const newPayment = {
        id: paymentId,
        instructions,
      };

      // 9. Upsert customer profile billing
      await tx
        .insert(customerProfiles)
        .values({
          userId: ctx.userId,
          billingName: input.billing.name,
          country: input.billing.country,
          company: input.billing.company ?? null,
          gstNumber: input.billing.gstNumber ?? null,
        })
        .onConflictDoUpdate({
          target: customerProfiles.userId,
          set: {
            billingName: input.billing.name,
            country: input.billing.country,
            company: input.billing.company ?? null,
            gstNumber: input.billing.gstNumber ?? null,
            updatedAt: now,
          },
        });

      // 10. Notifications and transactional emails
      await tx.insert(notifications).values({
        userId: ctx.userId,
        type: "order.created",
        title: "Order placed",
        body: `Order ${orderNo} placed for ${offering.name}. Complete payment within 7 days.`,
        link: `/checkout/${offering.id}`,
        payload: { orderId: newOrder!.id, orderNo },
      });

      await tx.insert(emailOutbox).values({
        toEmail: input.billing.email,
        template: "order-created",
        payload: {
          orderId: newOrder!.id,
          orderNo,
          name: input.billing.name,
          offeringName: offering.name,
          amount: (itemPricing.totalMinor / 100).toFixed(2),
        },
        priority: 5,
        status: "queued",
      });

      return {
        orderId: newOrder!.id,
        orderNo,
        payment: {
          paymentId: newPayment!.id,
          method: input.paymentMethod,
          instructions: instructions as any,
        },
        expiresAt: expiresAt.toISOString(),
      };
    };

    if (outerTx) {
      return await runner(outerTx);
    }
    return await withTx(runner);
  }

  // -- API-COM-03 cancelMyOrder -------------------------------------------------------------------

  async cancelMyOrder(
    ctx: RequestContext,
    input: CancelMyOrderInput,
    outerTx?: TxCtx,
  ): Promise<{ order: Order }> {
    const runner = async (tx: TxCtx): Promise<{ order: Order }> => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order || order.userId !== ctx.userId) {
        throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
      }

      if (order.status !== "pending_payment") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot cancel order with status '${order.status}'`,
        );
      }

      const now = new Date();
      const [cancelledOrder] = await tx
        .update(orders)
        .set({
          status: "cancelled",
          cancelledAt: now,
          updatedAt: now,
        })
        .where(eq(orders.id, order.id))
        .returning();

      // Open payments become failed with reason cancelled
      await tx
        .update(payments)
        .set({
          status: "failed",
          failureReason: "cancelled",
        })
        .where(
          and(
            eq(payments.orderId, order.id),
            inArray(payments.status, ["initiated", "submitted"]),
          ),
        );

      return { order: cancelledOrder! };
    };

    if (outerTx) {
      return await runner(outerTx);
    }
    return await withTx(runner);
  }

  // -- API-COM-04 retryPayment --------------------------------------------------------------------

  async retryPayment(
    ctx: RequestContext,
    input: RetryPaymentInput,
    outerTx?: TxCtx,
  ): Promise<{ payment: OrderPaymentHandle; expiresAt: string }> {
    const runner = async (tx: TxCtx): Promise<{ payment: OrderPaymentHandle; expiresAt: string }> => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order || order.userId !== ctx.userId) {
        throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
      }

      if (order.status !== "pending_payment") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot retry payment on order with status '${order.status}'`,
        );
      }

      const now = new Date();
      if (order.expiresAt && order.expiresAt < now) {
        throw new AppError(ErrorCode.ORDER_EXPIRED, "Order has expired and cannot be paid");
      }

      // Check if there is already a submitted payment awaiting admin review
      const [submittedPayment] = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.status, "submitted")))
        .limit(1);

      if (submittedPayment) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Payment reference already submitted and awaiting review",
        );
      }

      const settings = await settingsService.load(tx);
      const { paymentsService } = await import("@/modules/payments/service");
      const { paymentId, instructions } = await paymentsService.createIntentForOrder(
        order.id,
        input.paymentMethod as any,
        tx,
      );

      const newPayment = {
        id: paymentId,
        instructions,
      };

      return {
        payment: {
          paymentId: newPayment!.id,
          method: input.paymentMethod,
          instructions: instructions as any,
        },
        expiresAt: (order.expiresAt ?? now).toISOString(),
      };
    };

    if (outerTx) {
      return await runner(outerTx);
    }
    return await withTx(runner);
  }

  // -- API-COM-05 listMyOrders / getMyOrder -------------------------------------------------------

  async listMyOrders(
    ctx: RequestContext,
    input: ListMyOrdersInput,
  ): Promise<ListResult<OrderSummary>> {
    const db = await getDatabase();

    const conditions = [eq(orders.userId, ctx.userId)];
    if (input.filters?.status) {
      conditions.push(eq(orders.status, input.filters.status));
    }

    const pageSize = input.limit ?? 25;
    const rows = await db
      .select({
        orderId: orders.id,
        orderNo: orders.orderNo,
        type: orders.type,
        status: orders.status,
        totalMinor: orders.totalMinor,
        currency: orders.currency,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        expiresAt: orders.expiresAt,
      })
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(pageSize);

    const items: OrderSummary[] = rows.map((r) => ({
      orderId: r.orderId,
      orderNo: r.orderNo,
      type: r.type,
      status: r.status,
      total: money(r.totalMinor, r.currency as Currency),
      itemCount: 1,
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    }));

    return {
      items,
      nextCursor: null,
      total: items.length,
    };
  }

  async getMyOrder(ctx: RequestContext, input: GetMyOrderInput): Promise<OrderDetail> {
    const db = await getDatabase();

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNo, input.orderNo))
      .limit(1);

    if (!order || order.userId !== ctx.userId) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
    }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(orderItems.createdAt);

    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt));

    const paymentViews: OrderPaymentView[] = paymentRows.map((p) => ({
      paymentId: p.id,
      method: p.provider,
      status: p.status,
      amountDue: money(p.amountDueMinor, p.currency as Currency),
      amountReceived: p.amountReceivedMinor ? money(p.amountReceivedMinor, p.currency as Currency) : null,
      instructions: p.instructions as any,
      customerReference: p.customerReference,
      customerSubmittedAt: p.customerSubmittedAt ? p.customerSubmittedAt.toISOString() : null,
      bankShortfall: p.bankShortfallMinor ? money(p.bankShortfallMinor, p.currency as Currency) : null,
      customerCredit: p.customerCreditMinor ? money(p.customerCreditMinor, p.currency as Currency) : null,
      confirmedByName: null,
      confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
      failureReason: p.failureReason,
      createdAt: p.createdAt.toISOString(),
    }));

    return {
      order,
      items,
      itemMeta: {},
      payments: paymentViews,
      entitlements: [],
      instructionsHtml: "<p>Thank you for your order.</p>",
      refunds: [],
      customerExtra: { tags: [], notes: null },
    };
  }

  // -- API-COM-06 listOrdersAdmin / getOrderAdmin -------------------------------------------------

  async listOrdersAdmin(
    ctx: RequestContext,
    input: ListOrdersAdminInput,
  ): Promise<ListResult<OrderAdminRow>> {
    assertPermission(ctx, "orders.read");
    const db = await getDatabase();

    const pageSize = input.limit ?? 25;
    const rows = await db
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        type: orders.type,
        status: orders.status,
        totalMinor: orders.totalMinor,
        currency: orders.currency,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        expiresAt: orders.expiresAt,
        billingSnapshot: orders.billingSnapshot,
        userId: orders.userId,
        splitApprovalRequestId: orders.splitApprovalRequestId,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize);

    const orderIds = rows.map((r) => r.id);

    // Real item count + descriptions per order (was hardcoded to 1) -- one batched query against
    // the same `order_items` table already used elsewhere in this file.
    const itemRows =
      orderIds.length > 0
        ? await db
            .select({
              orderId: orderItems.orderId,
              description: orderItems.description,
            })
            .from(orderItems)
            .where(inArray(orderItems.orderId, orderIds))
            .orderBy(orderItems.createdAt)
        : [];
    const itemsByOrder = new Map<string, string[]>();
    for (const it of itemRows) {
      const list = itemsByOrder.get(it.orderId) ?? [];
      list.push(it.description);
      itemsByOrder.set(it.orderId, list);
    }

    // Real payment status per order (was hardcoded to "initiated") -- latest `payments` row per
    // order, picked in JS from a single query sorted desc by `created_at` (first row seen per
    // `orderId` while scanning in that order is the latest one for that order).
    const paymentRows =
      orderIds.length > 0
        ? await db
            .select({
              orderId: payments.orderId,
              id: payments.id,
              provider: payments.provider,
              status: payments.status,
              customerReference: payments.customerReference,
              bankShortfallMinor: payments.bankShortfallMinor,
              customerCreditMinor: payments.customerCreditMinor,
              createdAt: payments.createdAt,
            })
            .from(payments)
            .where(inArray(payments.orderId, orderIds))
            .orderBy(desc(payments.createdAt))
        : [];
    const latestPaymentByOrder = new Map<string, (typeof paymentRows)[number]>();
    for (const p of paymentRows) {
      if (!latestPaymentByOrder.has(p.orderId)) latestPaymentByOrder.set(p.orderId, p);
    }

    // Invoice numbers for orders that have one (paid+) -- cheap batched lookup, `invoices.order_id`
    // is unique so at most one row per order.
    const paidOrderIds = rows
      .filter((r) => r.status !== "pending_payment" && r.status !== "cancelled" && r.status !== "failed")
      .map((r) => r.id);
    const invoiceRows =
      paidOrderIds.length > 0
        ? await db
            .select({ orderId: invoices.orderId, invoiceNo: invoices.invoiceNo })
            .from(invoices)
            .where(inArray(invoices.orderId, paidOrderIds))
        : [];
    const invoiceByOrder = new Map(invoiceRows.map((i) => [i.orderId, i.invoiceNo]));

    const items: OrderAdminRow[] = rows.map((r) => {
      const payment = latestPaymentByOrder.get(r.id) ?? null;
      const descriptions = itemsByOrder.get(r.id) ?? [];
      return {
        orderId: r.id,
        orderNo: r.orderNo,
        type: r.type,
        status: r.status,
        total: money(r.totalMinor, r.currency as Currency),
        itemCount: descriptions.length,
        createdAt: r.createdAt.toISOString(),
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        customer: {
          userId: r.userId,
          name: r.billingSnapshot?.name || "Customer",
          email: r.billingSnapshot?.email || "",
        },
        paymentStatus: payment?.status ?? null,
        paymentId: payment?.id ?? null,
        paymentProvider: payment?.provider ?? null,
        paymentReference: payment?.customerReference ?? null,
        paymentCreatedAt: payment?.createdAt ? payment.createdAt.toISOString() : null,
        itemDescriptions: descriptions,
        invoiceNumber: invoiceByOrder.get(r.id) ?? null,
        // Only meaningful once a payment has been confirmed -- null before that (genuinely no
        // data yet, not a placeholder).
        shortfallMinor: payment?.bankShortfallMinor ?? null,
        customerCreditMinor: payment?.customerCreditMinor ?? null,
        splitApprovalRequestId: r.splitApprovalRequestId,
      };
    });

    return {
      items,
      nextCursor: null,
      total: items.length,
    };
  }

  async getOrderAdmin(ctx: RequestContext, input: GetOrderAdminInput): Promise<OrderDetail> {
    assertPermission(ctx, "orders.read");
    const db = await getDatabase();

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
    }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(orderItems.createdAt);

    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt));

    // Item metadata not on `order_items` itself: product name (catalog) for product lines,
    // delivery type (offerings) for product lines. Project lines have neither id and stay null.
    const productIds = Array.from(
      new Set(items.map((i) => i.productId).filter((id): id is string => id !== null)),
    );
    const offeringIds = Array.from(
      new Set(items.map((i) => i.offeringId).filter((id): id is string => id !== null)),
    );
    const [productRows, offeringRows] = await Promise.all([
      productIds.length > 0
        ? db
            .select({ id: products.id, name: products.name })
            .from(products)
            .where(inArray(products.id, productIds))
        : Promise.resolve([] as { id: string; name: string }[]),
      offeringIds.length > 0
        ? db
            .select({ id: offerings.id, deliveryType: offerings.deliveryType })
            .from(offerings)
            .where(inArray(offerings.id, offeringIds))
        : Promise.resolve([] as { id: string; deliveryType: string }[]),
    ]);
    const productNameById = new Map(productRows.map((p) => [p.id, p.name]));
    const offeringDeliveryById = new Map(offeringRows.map((o) => [o.id, o.deliveryType]));
    const itemMeta: OrderDetail["itemMeta"] = {};
    for (const it of items) {
      itemMeta[it.id] = {
        productName: it.productId ? (productNameById.get(it.productId) ?? null) : null,
        deliveryType: it.offeringId ? (offeringDeliveryById.get(it.offeringId) ?? null) : null,
      };
    }

    // "Confirmed by" display names -- resolved once per distinct admin, not per payment.
    const confirmedByIds = Array.from(
      new Set(paymentRows.map((p) => p.confirmedBy).filter((id): id is string => id !== null)),
    );
    const confirmedByRows =
      confirmedByIds.length > 0
        ? await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(inArray(users.id, confirmedByIds))
        : [];
    const confirmedByName = new Map(confirmedByRows.map((u) => [u.id, u.name]));

    const paymentViews: OrderPaymentView[] = paymentRows.map((p) => ({
      paymentId: p.id,
      method: p.provider,
      status: p.status,
      amountDue: money(p.amountDueMinor, p.currency as Currency),
      amountReceived: p.amountReceivedMinor ? money(p.amountReceivedMinor, p.currency as Currency) : null,
      instructions: p.instructions as any,
      customerReference: p.customerReference,
      customerSubmittedAt: p.customerSubmittedAt ? p.customerSubmittedAt.toISOString() : null,
      bankShortfall: p.bankShortfallMinor ? money(p.bankShortfallMinor, p.currency as Currency) : null,
      customerCredit: p.customerCreditMinor ? money(p.customerCreditMinor, p.currency as Currency) : null,
      confirmedByName: p.confirmedBy ? (confirmedByName.get(p.confirmedBy) ?? null) : null,
      confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
      failureReason: p.failureReason,
      createdAt: p.createdAt.toISOString(),
    }));

    // Refunds for this order (docs/06 API-PAY-05/06), most recent first, with approval status
    // and credit note number where issued.
    const refundRows = await db
      .select({
        id: refunds.id,
        amountMinor: refunds.amountMinor,
        currency: refunds.currency,
        reason: refunds.reason,
        createdAt: refunds.createdAt,
        approvalStatus: approvalRequests.status,
        creditNoteNo: creditNotes.creditNo,
      })
      .from(refunds)
      .leftJoin(approvalRequests, eq(refunds.approvalRequestId, approvalRequests.id))
      .leftJoin(creditNotes, eq(refunds.creditNoteId, creditNotes.id))
      .where(eq(refunds.orderId, order.id))
      .orderBy(desc(refunds.createdAt));

    const refundViews: OrderDetail["refunds"] = refundRows.map((r) => ({
      refundId: r.id,
      amountMinor: r.amountMinor,
      currency: r.currency as Currency,
      status: r.approvalStatus ?? "pending",
      creditNoteNo: r.creditNoteNo,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }));

    // Project orders: the split approval gating payment confirmation / invoice issue.
    let splitApproval: OrderDetail["splitApproval"];
    if (order.type === "project" && order.splitApprovalRequestId) {
      const [approval] = await db
        .select({ status: approvalRequests.status })
        .from(approvalRequests)
        .where(eq(approvalRequests.id, order.splitApprovalRequestId))
        .limit(1);
      if (approval) {
        splitApproval = { status: approval.status, approvalRequestId: order.splitApprovalRequestId };
      }
    }

    // Coupon / custom quote snapshot, when the order used one.
    let coupon: OrderDetail["coupon"];
    if (order.couponId) {
      const [c] = await db
        .select({ code: coupons.code })
        .from(coupons)
        .where(eq(coupons.id, order.couponId))
        .limit(1);
      if (c) coupon = { code: c.code, discountMinor: order.discountMinor };
    }
    let quote: OrderDetail["quote"];
    if (order.customQuoteId) {
      const [q] = await db
        .select({ title: customQuotes.title })
        .from(customQuotes)
        .where(eq(customQuotes.id, order.customQuoteId))
        .limit(1);
      if (q) quote = { id: order.customQuoteId, title: q.title };
    }

    // Invoice, when one has been issued (payment confirmed).
    const [invoiceRow] = await db
      .select({ id: invoices.id, invoiceNo: invoices.invoiceNo })
      .from(invoices)
      .where(eq(invoices.orderId, order.id))
      .limit(1);

    // `customer_profiles` fields not carried on the order's own billing snapshot (tags, internal
    // notes). Guest / no-profile orders keep the empty default.
    let customerExtra: OrderDetail["customerExtra"] = { tags: [], notes: null };
    if (order.userId) {
      const [profile] = await db
        .select({ tags: customerProfiles.tags, internalNotes: customerProfiles.internalNotes })
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, order.userId))
        .limit(1);
      if (profile) customerExtra = { tags: profile.tags, notes: profile.internalNotes };
    }

    return {
      order,
      items,
      itemMeta,
      payments: paymentViews,
      invoice: invoiceRow ? { invoiceId: invoiceRow.id, invoiceNo: invoiceRow.invoiceNo } : undefined,
      entitlements: [],
      instructionsHtml: "",
      refunds: refundViews,
      splitApproval,
      coupon,
      quote,
      customerExtra,
    };
  }

  // -- Fallback mutations / delegates -------------------------------------------------------------

  async createManualOrder(
    ctx: RequestContext,
    input: CreateManualOrderInput,
    tx?: TxCtx,
  ): Promise<CreateManualOrderResult> {
    return await createManualOrder(ctx, input, tx);
  }

  async applyProjectOrderSplit(
    payload: ProjectOrderSplitPayload,
    approvalRequestId: string,
    tx: TxCtx,
  ): Promise<void> {
    return await applyProjectOrderSplit(payload, approvalRequestId, tx);
  }

  // -- internal transitions -----------------------------------------------------------------------

  async markPaid(orderId: string, paidAt: Date, tx: TxCtx): Promise<Order> {
    const [order] = await tx
      .update(orders)
      .set({
        status: "paid",
        paidAt,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
    }

    // Load items to check for one_time offerings and populate user_offering_purchases (BR-10)
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const item of items) {
      if (item.offeringId && order.userId) {
        const [offering] = await tx
          .select({ purchaseModel: offerings.purchaseModel })
          .from(offerings)
          .where(eq(offerings.id, item.offeringId))
          .limit(1);

        if (offering?.purchaseModel === "one_time") {
          await tx
            .insert(userOfferingPurchases)
            .values({
              userId: order.userId,
              offeringId: item.offeringId,
              orderId: order.id,
            })
            .onConflictDoNothing();
        }
      }
    }

    // Redeem coupon if order used one
    if (order.couponId) {
      await couponsService.redeemForOrder(order.couponId, order.id, order.userId, tx);
    }

    return order;
  }

  async evaluateFulfilled(orderId: string, tx: TxCtx): Promise<{ fulfilled: boolean }> {
    return await markFulfilledIfComplete(orderId, tx);
  }

  async expirePendingOrders(now: Date = new Date(), tx?: TxCtx): Promise<ExpireOrdersResult> {
    return await expirePendingOrders(now, tx);
  }
}

export const ordersService: OrdersService = new DefaultOrdersService();

/** Preserved for freeze tests (PHASE-02 P2.8). */
export function createNotImplementedOrdersService(): OrdersService {
  return createNotImplemented<OrdersService>("orders", "P4", {
    previewCheckout: "async",
    createOrder: "async",
    cancelMyOrder: "async",
    retryPayment: "async",
    listMyOrders: "async",
    getMyOrder: "async",
    listOrdersAdmin: "async",
    getOrderAdmin: "async",
    createManualOrder: "async",
    applyProjectOrderSplit: "async",
    markPaid: "async",
    evaluateFulfilled: "async",
    expirePendingOrders: "async",
  });
}
