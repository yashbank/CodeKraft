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
  orderItems,
  orders,
  payments,
  userOfferingPurchases,
} from "../../../drizzle/schema/commerce";
import { offerings, offeringPrices, offeringPaymentMethods } from "../../../drizzle/schema/offerings";
import { products } from "../../../drizzle/schema/catalog";
import { users } from "../../../drizzle/schema/auth";
import { customerProfiles } from "../../../drizzle/schema/users-ext";
import { emailOutbox, notifications } from "../../../drizzle/schema/notifications";
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
    }));

    return {
      order,
      items,
      payments: paymentViews,
      entitlements: [],
      instructionsHtml: "<p>Thank you for your order.</p>",
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
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize);

    const items: OrderAdminRow[] = rows.map((r) => ({
      orderId: r.id,
      orderNo: r.orderNo,
      type: r.type,
      status: r.status,
      total: money(r.totalMinor, r.currency as Currency),
      itemCount: 1,
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      customer: {
        userId: r.userId,
        name: r.billingSnapshot?.name || "Customer",
        email: r.billingSnapshot?.email || "",
      },
      paymentStatus: "initiated",
      shortfallMinor: null,
      customerCreditMinor: null,
      splitApprovalRequestId: null,
    }));

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

    const paymentViews: OrderPaymentView[] = paymentRows.map((p) => ({
      paymentId: p.id,
      method: p.provider,
      status: p.status,
      amountDue: money(p.amountDueMinor, p.currency as Currency),
      amountReceived: p.amountReceivedMinor ? money(p.amountReceivedMinor, p.currency as Currency) : null,
      instructions: p.instructions as any,
      customerReference: p.customerReference,
      customerSubmittedAt: p.customerSubmittedAt ? p.customerSubmittedAt.toISOString() : null,
    }));

    return {
      order,
      items,
      payments: paymentViews,
      entitlements: [],
      instructionsHtml: "",
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
