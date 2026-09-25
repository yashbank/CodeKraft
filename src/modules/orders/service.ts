/**
 * `orders` service — PHASE-04 P4.2 (+ P4.7 via ./manual.ts, ./project-split.ts).
 *
 * Implements the frozen `OrdersService` contract (docs/06 §2.3 API-COM-01..07, API-COM-14, §5.1):
 * order numbering from `order_no_seq`, single-offering checkout with coupon + tax rules
 * (BR-08, D-1501), FX snapshot to INR (D-515), the BR-10 duplicate guard, idempotent pending
 * orders (docs/06 §1.5), cancel / retry (D-416), expiry (`failed`, never `cancelled`), the
 * fulfilment rule (MASTER_SPEC §7 "Order fulfilled") and the customer/admin read models.
 *
 * Money is integer minor units throughout (`lib/money`); this file is under `no-float-money`.
 */
import { type SQL, and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { orderScope } from "@/lib/authz/scope";
import { type TxCtx, type TxRunner, getDb, withTx } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { AppError, ErrorCode } from "@/lib/errors";
import { type Currency, type Money, assertCurrency, convertMinor } from "@/lib/money";
import { type RateLimitClass, type RateLimitScope, checkClass } from "@/lib/rate-limit";
import type { AnalyticsService } from "@/modules/analytics/contracts";
import type { ApprovalsService } from "@/modules/approvals/contracts";
import type { AuditService } from "@/modules/audit/contracts";
import type { CouponsService } from "@/modules/coupons/contracts";
import type { FxService } from "@/modules/fx/contracts";
import { classifyGst } from "@/modules/invoices/gst";
import type { NotificationsService } from "@/modules/notifications/contracts";
import type { PaymentsService } from "@/modules/payments/contracts";
import { toApiInstructions } from "@/modules/payments/instructions";
import type { QuotesService } from "@/modules/quotes/contracts";
import type { SettingsService } from "@/modules/settings/contracts";
import type { SiteSettings } from "@/modules/settings/types";
import { users } from "../../../drizzle/schema/auth";
import { products } from "../../../drizzle/schema/catalog";
import {
  type BillingSnapshot,
  type NewOrderItem,
  type Order,
  type OrderItem,
  type Payment,
  type SplitSnapshot,
  type TaxSnapshot,
  orderItems,
  orders,
  payments,
  userOfferingPurchases,
} from "../../../drizzle/schema/commerce";
import { entitlements, serviceProgress } from "../../../drizzle/schema/delivery";
import { allocations } from "../../../drizzle/schema/finance";
import { invoices } from "../../../drizzle/schema/invoices";
import { offeringPaymentMethods, offeringPrices, offerings } from "../../../drizzle/schema/offerings";
import { customerProfiles } from "../../../drizzle/schema/users-ext";
import type { OrdersService } from "./contracts";
import { activeOwnershipId, partnerProductsSubquery } from "./deps";
import { renderInstructionsHtml } from "./instructions";
import { createManualOrder as createManualOrderImpl } from "./manual";
import { nextOrderNo } from "./numbering";
import { applyProjectOrderSplit as applyProjectOrderSplitImpl } from "./project-split";
import { assertTransition, isExpired } from "./state";
import { type OrderTotals, priceSingleLine } from "./totals";
import {
  type BillingInput,
  type CancelMyOrderInput,
  type CheckoutLine,
  type CheckoutPreview,
  type CreateManualOrderInput,
  type CreateManualOrderResult,
  type CreateOrderInput,
  type CreateOrderResult,
  type ExpireOrdersResult,
  type GetMyOrderInput,
  type GetOrderAdminInput,
  type ListMyOrdersInput,
  type ListOrdersAdminInput,
  type ListResult,
  MANUAL_PAYMENT_METHODS,
  type ManualPaymentMethod,
  ORDER_EXPIRY_DAYS,
  type OrderAdminRow,
  type OrderDetail,
  type OrderPaymentHandle,
  type OrderPaymentView,
  type OrderSummary,
  type OrderType,
  type PreviewCheckoutInput,
  type ProjectOrderSplitPayload,
  type RetryPaymentInput,
  isFulfilled,
  taxRateBpsFor,
} from "./types";

// ---------------------------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------------------------

export type RateLimiter = (
  cls: RateLimitClass,
  subjects: Partial<Record<RateLimitScope, string>>,
) => Promise<void>;

export interface OrdersServiceDeps {
  db: TxRunner;
  payments: Pick<PaymentsService, "createIntentForOrder" | "confirmPayment">;
  coupons: Pick<CouponsService, "validateForOrder" | "redeemForOrder">;
  quotes: Pick<QuotesService, "markPaid">;
  approvals: Pick<ApprovalsService, "request">;
  settings: Pick<SettingsService, "load">;
  fx: Pick<FxService, "getRate">;
  notifications: Pick<NotificationsService, "emit">;
  audit: Pick<AuditService, "log">;
  analytics?: Pick<AnalyticsService, "recordServerEvent">;
  rateLimit?: RateLimiter;
  now?: () => Date;
}

export async function defaultRateLimit(
  cls: RateLimitClass,
  subjects: Partial<Record<RateLimitScope, string>>,
): Promise<void> {
  const result = await checkClass(cls, subjects);
  if (!result.allowed) {
    throw new AppError(ErrorCode.RATE_LIMITED, undefined, {
      retryAfterMs: Math.max(0, result.resetAt - Date.now()),
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Shared shapes used by ./manual.ts and quotes
// ---------------------------------------------------------------------------------------------

export interface OfferingContext {
  offering: typeof offerings.$inferSelect;
  product: typeof products.$inferSelect;
  prices: (typeof offeringPrices.$inferSelect)[];
  methods: string[];
}

export interface OrderLineInsert extends CheckoutLine {
  offeringId: string | null;
  productId: string | null;
  ownershipId: string | null;
  splitSnapshot: SplitSnapshot | null;
}

export interface InsertOrderInput {
  type: OrderType;
  userId: string | null;
  client?: { name: string; email: string; company?: string | null } | undefined;
  currency: Currency;
  lines: OrderLineInsert[];
  totals: OrderTotals;
  couponId: string | null;
  customQuoteId: string | null;
  billing: BillingInput;
  taxRateBps: number;
  taxSnapshot: TaxSnapshot | null;
  expiresAt: Date | null;
  createdBy: string | null;
}

export interface OrdersInternal {
  /** Load offering + product + prices + methods, `NOT_FOUND` when missing. */
  loadOfferingContext(offeringId: string, tx: TxCtx): Promise<OfferingContext>;
  /** Insert the order + items with the FX snapshot; no payment, no notifications. */
  insertOrder(input: InsertOrderInput, tx: TxCtx): Promise<{ order: Order; items: OrderItem[] }>;
  /** Persist the customer's billing details on `customer_profiles` (D-410). */
  upsertBillingProfile(userId: string, billing: BillingInput, tx: TxCtx): Promise<void>;
  /** API-COM-10: order for an accepted custom quote (single line at the negotiated amount, no coupons). */
  createOrderForQuote(
    ctx: RequestContext,
    input: {
      quoteId: string;
      title: string;
      offeringId: string | null;
      currency: Currency;
      amountMinor: number;
      paymentMethod: ManualPaymentMethod;
      billing: BillingInput;
    },
    tx: TxCtx,
  ): Promise<CreateOrderResult>;
  /** Enabled checkout methods = offering ∩ settings ∩ flags (manual methods only in release 1). */
  enabledMethodsFor(offeringMethods: readonly string[], settings: SiteSettings): ManualPaymentMethod[];
  readonly deps: OrdersServiceDeps;
}

export type OrdersModule = OrdersService & OrdersInternal;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

export function toBillingSnapshot(b: BillingInput): BillingSnapshot {
  return {
    name: b.name,
    email: b.email,
    country: b.country,
    company: b.company ?? null,
    address: b.address ?? null,
    gst_number: b.gstNumber ?? null,
  };
}

export function buildTaxSnapshot(input: {
  rateBps: number;
  gstin: string | null;
  billing: BillingInput;
}): TaxSnapshot {
  const gst = classifyGst({
    sellerGstin: input.gstin,
    buyerGstNumber: input.billing.gstNumber ?? null,
    buyerCountry: input.billing.country,
  });
  return {
    rate_bps: input.rateBps,
    seller_state: gst.sellerState,
    buyer_state: gst.buyerState,
    buyer_country: input.billing.country,
    gst_number: input.billing.gstNumber ?? null,
    kind: input.rateBps > 0 ? gst.kind : "none",
  };
}

/** `or(a, b)` typed as a definite SQL fragment (drizzle's `or` is `SQL | undefined`). */
function either(a: SQL | undefined, b: SQL | undefined): SQL {
  const combined = or(a, b);
  if (combined === undefined) throw new Error("either(): both operands undefined");
  return combined;
}

function encodeCursor(value: unknown, id: string): string {
  return Buffer.from(JSON.stringify([value, id]), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): [unknown, string] | null {
  if (cursor === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[1] === "string") {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // fall through
  }
  throw new AppError(ErrorCode.VALIDATION, undefined, { fieldErrors: { cursor: ["invalid cursor"] } });
}

function toSummary(o: Order, itemCount: number): OrderSummary {
  return {
    orderId: o.id,
    orderNo: o.orderNo,
    type: o.type,
    status: o.status,
    total: { amountMinor: o.totalMinor, currency: assertCurrency(o.currency) },
    itemCount,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    expiresAt: o.expiresAt?.toISOString() ?? null,
  };
}

function toPaymentView(p: Payment): OrderPaymentView {
  const currency = assertCurrency(p.currency);
  return {
    paymentId: p.id,
    method: p.provider,
    status: p.status,
    amountDue: { amountMinor: p.amountDueMinor, currency },
    amountReceived:
      p.amountReceivedMinor === null ? null : { amountMinor: p.amountReceivedMinor, currency },
    instructions: p.instructions === null ? null : toApiInstructions(p.instructions),
    customerReference: p.customerReference,
    customerSubmittedAt: p.customerSubmittedAt?.toISOString() ?? null,
  };
}

function toPaymentHandle(p: Payment): OrderPaymentHandle {
  if (p.instructions === null) {
    throw new AppError(ErrorCode.STATE_INVALID, "Payment has no instructions.");
  }
  return {
    paymentId: p.id,
    method: p.provider as ManualPaymentMethod,
    instructions: toApiInstructions(p.instructions),
  };
}

const OPEN_PAYMENT_STATUSES = ["initiated", "submitted"] as const;

// ---------------------------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------------------------

export function createOrdersService(deps: OrdersServiceDeps): OrdersModule {
  const now = deps.now ?? (() => new Date());
  const rateLimit = deps.rateLimit ?? defaultRateLimit;

  async function loadOfferingContext(offeringId: string, tx: TxCtx): Promise<OfferingContext> {
    const [row] = await tx
      .select({ offering: offerings, product: products })
      .from(offerings)
      .innerJoin(products, eq(products.id, offerings.productId))
      .where(eq(offerings.id, offeringId))
      .limit(1);
    if (row === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Offering not found.");
    const [prices, methodRows] = await Promise.all([
      tx.select().from(offeringPrices).where(eq(offeringPrices.offeringId, offeringId)),
      tx
        .select({ method: offeringPaymentMethods.method })
        .from(offeringPaymentMethods)
        .where(eq(offeringPaymentMethods.offeringId, offeringId)),
    ]);
    return { offering: row.offering, product: row.product, prices, methods: methodRows.map((m) => m.method) };
  }

  function assertPurchasable(ctx: OfferingContext): void {
    const { offering, product } = ctx;
    if (offering.status !== "active") {
      throw new AppError(ErrorCode.STATE_INVALID, "This offering is not available.");
    }
    if (product.status !== "published") {
      throw new AppError(ErrorCode.STATE_INVALID, "This product is not published.");
    }
    if (product.isComingSoon) {
      throw new AppError(ErrorCode.STATE_INVALID, "This product is coming soon and cannot be bought yet.");
    }
    if (offering.purchaseModel === "custom_quote") {
      throw new AppError(ErrorCode.STATE_INVALID, "This offering is sold by custom quote only.");
    }
  }

  function priceInBase(ctx: OfferingContext, currency: Currency): number {
    const price = ctx.prices.find((p) => p.currency === currency);
    if (price === undefined) {
      throw new AppError(ErrorCode.STATE_INVALID, `This offering has no ${currency} price.`);
    }
    return price.amountMinor;
  }

  function enabledMethodsFor(offeringMethods: readonly string[], settings: SiteSettings): ManualPaymentMethod[] {
    const enabled = new Set<string>(settings.enabledPaymentMethods);
    return MANUAL_PAYMENT_METHODS.filter((m) => offeringMethods.includes(m) && enabled.has(m));
  }

  async function alreadyOwned(userId: string, offeringId: string, tx: TxCtx): Promise<boolean> {
    const [row] = await tx
      .select({ id: userOfferingPurchases.id })
      .from(userOfferingPurchases)
      .where(and(eq(userOfferingPurchases.userId, userId), eq(userOfferingPurchases.offeringId, offeringId)))
      .limit(1);
    return row !== undefined;
  }

  async function assertNotDuplicate(userId: string, ctx: OfferingContext, tx: TxCtx): Promise<void> {
    if (ctx.offering.purchaseModel !== "one_time") return;
    if (await alreadyOwned(userId, ctx.offering.id, tx)) {
      throw new AppError(ErrorCode.DUPLICATE_PURCHASE);
    }
  }

  async function fxRateToInr(currency: Currency, tx: TxCtx): Promise<string> {
    if (currency === "INR") return "1.00000000";
    const quote = await deps.fx.getRate({ base: currency, quote: "INR" }, tx);
    return quote.rate;
  }

  async function insertOrder(input: InsertOrderInput, tx: TxCtx): Promise<{ order: Order; items: OrderItem[] }> {
    const orderNo = await nextOrderNo(tx);
    const fxRate = await fxRateToInr(input.currency, tx);
    const [order] = await tx
      .insert(orders)
      .values({
        orderNo,
        type: input.type,
        userId: input.userId,
        clientName: input.client?.name ?? null,
        clientEmail: input.client?.email ?? null,
        clientCompany: input.client?.company ?? null,
        status: "pending_payment",
        currency: input.currency,
        subtotalMinor: input.totals.subtotal.amountMinor,
        discountMinor: input.totals.discount.amountMinor,
        taxMinor: input.totals.tax.amountMinor,
        totalMinor: input.totals.total.amountMinor,
        couponId: input.couponId,
        customQuoteId: input.customQuoteId,
        billingSnapshot: toBillingSnapshot(input.billing),
        taxRateBps: input.taxRateBps,
        taxSnapshot: input.taxSnapshot,
        fxRateToInr: fxRate,
        expiresAt: input.expiresAt,
        createdBy: input.createdBy,
      })
      .returning();
    if (order === undefined) throw new Error("orders insert returned no row");
    const values: NewOrderItem[] = input.lines.map((l) => ({
      orderId: order.id,
      offeringId: l.offeringId,
      productId: l.productId,
      description: l.description,
      quantity: l.quantity,
      unitMinor: l.unitMinor,
      discountMinor: l.discountMinor,
      taxMinor: l.taxMinor,
      totalMinor: l.totalMinor,
      ownershipId: l.ownershipId,
      splitSnapshot: l.splitSnapshot,
    }));
    const items = await tx.insert(orderItems).values(values).returning();
    return { order, items };
  }

  async function upsertBillingProfile(userId: string, billing: BillingInput, tx: TxCtx): Promise<void> {
    const address =
      billing.address === undefined || billing.address === ""
        ? undefined
        : { line1: billing.address, city: "", postalCode: "", country: billing.country };
    await tx
      .insert(customerProfiles)
      .values({
        userId,
        company: billing.company ?? null,
        billingName: billing.name,
        billingAddress: address ?? null,
        country: billing.country,
        gstNumber: billing.gstNumber ?? null,
      })
      .onConflictDoUpdate({
        target: customerProfiles.userId,
        set: {
          company: billing.company ?? null,
          billingName: billing.name,
          ...(address === undefined ? {} : { billingAddress: address }),
          country: billing.country,
          gstNumber: billing.gstNumber ?? null,
          updatedAt: now(),
        },
      });
  }

  async function findPendingOrderFor(userId: string, offeringId: string, tx: TxCtx): Promise<Order | null> {
    const [row] = await tx
      .select({ order: orders })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.userId, userId),
          eq(orders.status, "pending_payment"),
          eq(orders.type, "product"),
          isNull(orders.customQuoteId),
          eq(orderItems.offeringId, offeringId),
          or(isNull(orders.expiresAt), gt(orders.expiresAt, now())),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(1);
    return row?.order ?? null;
  }

  async function latestOpenPayment(orderId: string, tx: TxCtx): Promise<Payment | null> {
    const [row] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), inArray(payments.status, [...OPEN_PAYMENT_STATUSES])))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    return row ?? null;
  }

  async function assertVerifiedCustomer(userId: string, tx: TxCtx): Promise<typeof users.$inferSelect> {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user === undefined) throw new AppError(ErrorCode.UNAUTHENTICATED);
    if (user.status === "suspended") throw new AppError(ErrorCode.ACCOUNT_SUSPENDED);
    if (!user.emailVerified) throw new AppError(ErrorCode.EMAIL_UNVERIFIED);
    return user;
  }

  async function loadOwnOrder(userId: string, where: SQL, tx: TxCtx): Promise<Order> {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(where, eq(orders.userId, userId)))
      .limit(1);
    if (order === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
    return order;
  }

  async function priceCheckout(
    ctx: RequestContext,
    input: PreviewCheckoutInput,
    settings: SiteSettings,
    tx: TxCtx,
  ): Promise<{
    offeringCtx: OfferingContext;
    line: CheckoutLine;
    totals: OrderTotals;
    taxRateBps: number;
    coupon: { id: string; code: string; kind: "percent" | "fixed"; value: number } | null;
    warnings: string[];
  }> {
    const offeringCtx = await loadOfferingContext(input.offeringId, tx);
    assertPurchasable(offeringCtx);
    const currency = settings.baseCurrency;
    const unitMinor = priceInBase(offeringCtx, currency);
    const warnings: string[] = [];
    let discountMinor = 0;
    let coupon: { id: string; code: string; kind: "percent" | "fixed"; value: number } | null = null;
    if (input.couponCode !== undefined) {
      await rateLimit("coupon", { user: ctx.userId });
      const validation = await deps.coupons.validateForOrder(
        {
          code: input.couponCode,
          userId: ctx.userId,
          productId: offeringCtx.product.id,
          subtotal: { amountMinor: unitMinor, currency },
        },
        tx,
      );
      if (!validation.valid) {
        throw new AppError(ErrorCode.VALIDATION, `Coupon rejected: ${validation.reason.replace(/_/g, " ")}.`, {
          fieldErrors: { couponCode: [validation.reason] },
        });
      }
      discountMinor = validation.discountMinor;
      coupon = { id: validation.coupon.id, code: validation.coupon.code, kind: validation.coupon.kind, value: validation.coupon.value };
    }
    const taxRateBps = taxRateBpsFor({
      productTaxEnabled: offeringCtx.product.taxEnabled,
      gstin: settings.gstin,
      settingsTaxRateBps: settings.taxRateBps,
    });
    if (offeringCtx.product.taxEnabled && taxRateBps === 0) {
      warnings.push("Tax is not applied until a GSTIN is configured.");
    }
    const { line, totals } = priceSingleLine({
      description: `${offeringCtx.product.name} — ${offeringCtx.offering.name}`,
      unitMinor,
      discountMinor,
      taxRateBps,
      currency,
    });
    return { offeringCtx, line, totals, taxRateBps, coupon, warnings };
  }

  async function displayTotal(total: Money, ctx: RequestContext, tx: TxCtx): Promise<Money> {
    const [user] = await tx.select({ displayCurrency: users.displayCurrency }).from(users).where(eq(users.id, ctx.userId)).limit(1);
    const wanted = user?.displayCurrency;
    if (wanted === undefined || wanted === total.currency) return total;
    try {
      const target = assertCurrency(wanted);
      const quote = await deps.fx.getRate({ base: total.currency, quote: target }, tx);
      return { amountMinor: convertMinor(total.amountMinor, quote.rate), currency: target };
    } catch {
      return total;
    }
  }

  async function emitOrderCreated(order: Order, payment: Payment, tx: TxCtx): Promise<void> {
    if (order.userId === null) return;
    await deps.notifications.emit(
      order.userId,
      "order.created",
      {
        orderId: order.id,
        orderNo: order.orderNo,
        totalMinor: order.totalMinor,
        currency: order.currency,
        paymentId: payment.id,
        method: payment.provider,
        expiresAt: order.expiresAt?.toISOString() ?? null,
      },
      ["inapp", "email"],
      tx,
    );
  }

  async function createIntent(orderId: string, method: ManualPaymentMethod, tx: TxCtx): Promise<Payment> {
    const { paymentId } = await deps.payments.createIntentForOrder(orderId, method, tx);
    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (payment === undefined) throw new Error("payment intent not persisted");
    return payment;
  }

  const service: OrdersModule = {
    deps,
    loadOfferingContext,
    insertOrder,
    upsertBillingProfile,
    enabledMethodsFor,

    // -- API-COM-01 -------------------------------------------------------------------------------
    async previewCheckout(ctx, input): Promise<CheckoutPreview> {
      return withTx(async (tx) => {
        const settings = await deps.settings.load(tx);
        const priced = await priceCheckout(ctx, input, settings, tx);
        const { offeringCtx } = priced;
        if (offeringCtx.offering.purchaseModel === "one_time" && (await alreadyOwned(ctx.userId, offeringCtx.offering.id, tx))) {
          throw new AppError(ErrorCode.DUPLICATE_PURCHASE);
        }
        const enabledMethods = enabledMethodsFor(offeringCtx.methods, settings);
        const warnings = [...priced.warnings];
        if (enabledMethods.length === 0) warnings.push("No payment method is currently enabled for this offering.");
        return {
          offering: {
            id: offeringCtx.offering.id,
            title: offeringCtx.offering.name,
            purchaseModel: offeringCtx.offering.purchaseModel,
            deliveryType: offeringCtx.offering.deliveryType,
          },
          product: {
            id: offeringCtx.product.id,
            slug: offeringCtx.product.slug,
            title: offeringCtx.product.name,
            taxEnabled: offeringCtx.product.taxEnabled,
            isRefundable: offeringCtx.product.isRefundable,
          },
          lines: [priced.line],
          subtotal: priced.totals.subtotal,
          discount: priced.totals.discount,
          tax: priced.totals.tax,
          total: priced.totals.total,
          displayTotal: await displayTotal(priced.totals.total, ctx, tx),
          taxRateBps: priced.taxRateBps,
          ...(priced.coupon === null ? {} : { coupon: { code: priced.coupon.code, kind: priced.coupon.kind, value: priced.coupon.value } }),
          enabledMethods,
          warnings,
        };
      }, undefined, deps.db);
    },

    // -- API-COM-02 -------------------------------------------------------------------------------
    async createOrder(ctx, input, outerTx): Promise<CreateOrderResult> {
      return withTx(async (tx) => {
        await assertVerifiedCustomer(ctx.userId, tx);
        await rateLimit("checkout", { user: ctx.userId });

        const existing = await findPendingOrderFor(ctx.userId, input.offeringId, tx);
        if (existing !== null) {
          const open = (await latestOpenPayment(existing.id, tx)) ?? (await createIntent(existing.id, input.paymentMethod, tx));
          return {
            orderId: existing.id,
            orderNo: existing.orderNo,
            payment: toPaymentHandle(open),
            expiresAt: existing.expiresAt?.toISOString() ?? "",
          };
        }

        const settings = await deps.settings.load(tx);
        const priced = await priceCheckout(ctx, input, settings, tx);
        await assertNotDuplicate(ctx.userId, priced.offeringCtx, tx);
        if (!enabledMethodsFor(priced.offeringCtx.methods, settings).includes(input.paymentMethod)) {
          throw new AppError(ErrorCode.STATE_INVALID, "This payment method is not enabled for the offering.");
        }

        const ownershipId = await activeOwnershipId(priced.offeringCtx.product.id, tx);
        const { order, items } = await insertOrder(
          {
            type: "product",
            userId: ctx.userId,
            currency: settings.baseCurrency,
            lines: [
              {
                ...priced.line,
                offeringId: priced.offeringCtx.offering.id,
                productId: priced.offeringCtx.product.id,
                ownershipId,
                splitSnapshot: null,
              },
            ],
            totals: priced.totals,
            couponId: priced.coupon?.id ?? null,
            customQuoteId: null,
            billing: input.billing,
            taxRateBps: priced.taxRateBps,
            taxSnapshot: buildTaxSnapshot({ rateBps: priced.taxRateBps, gstin: settings.gstin, billing: input.billing }),
            expiresAt: addDays(now(), ORDER_EXPIRY_DAYS),
            createdBy: null,
          },
          tx,
        );
        const payment = await createIntent(order.id, input.paymentMethod, tx);
        await upsertBillingProfile(ctx.userId, input.billing, tx);
        await emitOrderCreated(order, payment, tx);
        await deps.analytics?.recordServerEvent(
          { name: "checkout_start", userId: ctx.userId, orderId: order.id, productId: items[0]?.productId ?? null },
          tx,
        );
        return {
          orderId: order.id,
          orderNo: order.orderNo,
          payment: toPaymentHandle(payment),
          expiresAt: order.expiresAt?.toISOString() ?? "",
        };
      }, outerTx, deps.db);
    },

    // -- API-COM-10 support -----------------------------------------------------------------------
    async createOrderForQuote(ctx, input, tx): Promise<CreateOrderResult> {
      const settings = await deps.settings.load(tx);
      if (input.currency !== settings.baseCurrency) {
        throw new AppError(ErrorCode.STATE_INVALID, "Quotes are charged in the base currency only.");
      }
      let offeringCtx: OfferingContext | null = null;
      if (input.offeringId !== null) {
        offeringCtx = await loadOfferingContext(input.offeringId, tx);
        if (offeringCtx.offering.status !== "active") {
          throw new AppError(ErrorCode.STATE_INVALID, "This offering is not available.");
        }
      }
      const methods = offeringCtx === null ? [...MANUAL_PAYMENT_METHODS] : offeringCtx.methods;
      if (!enabledMethodsFor(methods, settings).includes(input.paymentMethod)) {
        throw new AppError(ErrorCode.STATE_INVALID, "This payment method is not enabled.");
      }
      const taxRateBps = taxRateBpsFor({
        productTaxEnabled: offeringCtx?.product.taxEnabled ?? true,
        gstin: settings.gstin,
        settingsTaxRateBps: settings.taxRateBps,
      });
      const { line, totals } = priceSingleLine({
        description: input.title,
        unitMinor: input.amountMinor,
        discountMinor: 0,
        taxRateBps,
        currency: input.currency,
      });
      const ownershipId = offeringCtx === null ? null : await activeOwnershipId(offeringCtx.product.id, tx);
      const { order } = await insertOrder(
        {
          type: "product",
          userId: ctx.userId,
          currency: input.currency,
          lines: [
            {
              ...line,
              offeringId: offeringCtx?.offering.id ?? null,
              productId: offeringCtx?.product.id ?? null,
              ownershipId,
              splitSnapshot: null,
            },
          ],
          totals,
          couponId: null,
          customQuoteId: input.quoteId,
          billing: input.billing,
          taxRateBps,
          taxSnapshot: buildTaxSnapshot({ rateBps: taxRateBps, gstin: settings.gstin, billing: input.billing }),
          expiresAt: addDays(now(), ORDER_EXPIRY_DAYS),
          createdBy: null,
        },
        tx,
      );
      const payment = await createIntent(order.id, input.paymentMethod, tx);
      await upsertBillingProfile(ctx.userId, input.billing, tx);
      await emitOrderCreated(order, payment, tx);
      return {
        orderId: order.id,
        orderNo: order.orderNo,
        payment: toPaymentHandle(payment),
        expiresAt: order.expiresAt?.toISOString() ?? "",
      };
    },

    // -- API-COM-03 -------------------------------------------------------------------------------
    async cancelMyOrder(ctx, input: CancelMyOrderInput, outerTx) {
      return withTx(async (tx) => {
        const order = await loadOwnOrder(ctx.userId, eq(orders.id, input.orderId), tx);
        if (order.status !== "pending_payment") {
          throw new AppError(ErrorCode.STATE_INVALID, "Only orders awaiting payment can be cancelled.");
        }
        const submitted = await tx
          .select({ id: payments.id })
          .from(payments)
          .where(and(eq(payments.orderId, order.id), eq(payments.status, "submitted")))
          .limit(1);
        if (submitted.length > 0) {
          throw new AppError(ErrorCode.STATE_INVALID, "A payment reference was already submitted; contact support to cancel.");
        }
        assertTransition(order.status, "cancelled", order.orderNo);
        const [updated] = await tx
          .update(orders)
          .set({ status: "cancelled", cancelledAt: now(), updatedAt: now() })
          .where(and(eq(orders.id, order.id), eq(orders.status, "pending_payment")))
          .returning();
        if (updated === undefined) throw new AppError(ErrorCode.CONFLICT);
        await tx
          .update(payments)
          .set({ status: "failed", failureReason: "cancelled" })
          .where(and(eq(payments.orderId, order.id), inArray(payments.status, [...OPEN_PAYMENT_STATUSES])));
        await deps.audit.log(ctx, "API-COM-03 order.cancel", { type: "order", id: order.id }, { status: order.status }, { status: "cancelled" }, tx);
        return { order: updated };
      }, outerTx, deps.db);
    },

    // -- API-COM-04 -------------------------------------------------------------------------------
    async retryPayment(ctx, input: RetryPaymentInput, outerTx) {
      return withTx(async (tx) => {
        await rateLimit("checkout", { user: ctx.userId });
        const order = await loadOwnOrder(ctx.userId, eq(orders.id, input.orderId), tx);
        if (order.status !== "pending_payment") {
          throw new AppError(ErrorCode.STATE_INVALID, "This order is no longer awaiting payment.");
        }
        if (isExpired(order, now())) throw new AppError(ErrorCode.ORDER_EXPIRED);
        const open = await latestOpenPayment(order.id, tx);
        if (open !== null && open.status === "submitted") {
          throw new AppError(ErrorCode.STATE_INVALID, "A payment reference is awaiting confirmation.");
        }
        if (open !== null) {
          // D-416: the previous attempt stays on record; only one open attempt at a time.
          await tx.update(payments).set({ status: "failed", failureReason: "superseded" }).where(eq(payments.id, open.id));
        }
        const settings = await deps.settings.load(tx);
        const [firstItem] = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id)).limit(1);
        const methods =
          firstItem?.offeringId === null || firstItem === undefined
            ? [...MANUAL_PAYMENT_METHODS]
            : (await loadOfferingContext(firstItem.offeringId, tx)).methods;
        if (!enabledMethodsFor(methods, settings).includes(input.paymentMethod)) {
          throw new AppError(ErrorCode.STATE_INVALID, "This payment method is not enabled for the offering.");
        }
        const payment = await createIntent(order.id, input.paymentMethod, tx);
        return { payment: toPaymentHandle(payment), expiresAt: order.expiresAt?.toISOString() ?? "" };
      }, outerTx, deps.db);
    },

    // -- API-COM-05 -------------------------------------------------------------------------------
    async listMyOrders(ctx, input: ListMyOrdersInput): Promise<ListResult<OrderSummary>> {
      return withTx(async (tx) => {
        const cursor = decodeCursor(input.cursor);
        const dir = input.sort?.endsWith(":asc") ? "asc" : "desc";
        const conditions: SQL[] = [eq(orders.userId, ctx.userId)];
        if (input.filters?.status !== undefined) conditions.push(eq(orders.status, input.filters.status));
        if (cursor !== null) {
          const at = new Date(String(cursor[0]));
          conditions.push(
            dir === "desc"
              ? either(lt(orders.createdAt, at), and(eq(orders.createdAt, at), lt(orders.id, cursor[1])))
              : either(gt(orders.createdAt, at), and(eq(orders.createdAt, at), gt(orders.id, cursor[1]))),
          );
        }
        const rows = await tx
          .select({ order: orders, itemCount: sql<number>`(select count(*)::int from ${orderItems} oi where oi.order_id = ${orders.id})` })
          .from(orders)
          .where(and(...conditions))
          .orderBy(dir === "desc" ? desc(orders.createdAt) : asc(orders.createdAt), dir === "desc" ? desc(orders.id) : asc(orders.id))
          .limit(input.limit + 1);
        const page = rows.slice(0, input.limit);
        const last = page[page.length - 1];
        return {
          items: page.map((r) => toSummary(r.order, r.itemCount)),
          nextCursor: rows.length > input.limit && last !== undefined ? encodeCursor(last.order.createdAt.toISOString(), last.order.id) : null,
        };
      }, undefined, deps.db);
    },

    async getMyOrder(ctx, input: GetMyOrderInput): Promise<OrderDetail> {
      return withTx(async (tx) => {
        const order = await loadOwnOrder(ctx.userId, eq(orders.orderNo, input.orderNo), tx);
        return buildDetail(order, tx);
      }, undefined, deps.db);
    },

    // -- API-COM-06 -------------------------------------------------------------------------------
    async listOrdersAdmin(ctx, input: ListOrdersAdminInput): Promise<ListResult<OrderAdminRow>> {
      return withTx(async (tx) => {
        const scope = orderScope(ctx);
        const conditions: SQL[] = [];
        if (scope !== "all") {
          conditions.push(
            sql`exists (select 1 from ${orderItems} oi where oi.order_id = ${orders.id} and oi.product_id in ${partnerProductsSubquery(scope.partnerId)})`,
          );
        }
        const f = input.filters;
        if (f?.status !== undefined) conditions.push(eq(orders.status, f.status));
        if (f?.type !== undefined) conditions.push(eq(orders.type, f.type));
        if (f?.userId !== undefined) conditions.push(eq(orders.userId, f.userId));
        if (f?.productId !== undefined) {
          conditions.push(
            sql`exists (select 1 from ${orderItems} oi where oi.order_id = ${orders.id} and oi.product_id = ${f.productId})`,
          );
        }
        if (f?.dateFrom !== undefined) conditions.push(sql`${orders.createdAt} >= ${f.dateFrom}::date`);
        if (f?.dateTo !== undefined) conditions.push(sql`${orders.createdAt} < (${f.dateTo}::date + interval '1 day')`);
        if (input.q !== undefined && input.q !== "") {
          const q = `%${input.q}%`;
          conditions.push(
            sql`(${orders.orderNo} ilike ${q} or ${orders.billingSnapshot}->>'email' ilike ${q} or ${orders.clientEmail} ilike ${q})`,
          );
        }
        const [field, dirRaw] = (input.sort ?? "createdAt:desc").split(":");
        const dir = dirRaw === "asc" ? "asc" : "desc";
        const column = field === "total" ? orders.totalMinor : field === "status" ? orders.status : orders.createdAt;
        const cursor = decodeCursor(input.cursor);
        if (cursor !== null) {
          const v = field === "createdAt" ? new Date(String(cursor[0])) : (cursor[0] as string | number);
          const cmp = dir === "desc" ? lt : gt;
          conditions.push(either(cmp(column, v as never), and(eq(column, v as never), cmp(orders.id, cursor[1]))));
        }
        const rows = await tx
          .select({ order: orders, itemCount: sql<number>`(select count(*)::int from ${orderItems} oi where oi.order_id = ${orders.id})` })
          .from(orders)
          .where(conditions.length === 0 ? undefined : and(...conditions))
          .orderBy(dir === "desc" ? desc(column) : asc(column), dir === "desc" ? desc(orders.id) : asc(orders.id))
          .limit(input.limit + 1);
        const page = rows.slice(0, input.limit);
        const ids = page.map((r) => r.order.id);
        const [paymentRows, allocationRows] =
          ids.length === 0
            ? [[], []]
            : await Promise.all([
                tx.select().from(payments).where(inArray(payments.orderId, ids)).orderBy(desc(payments.createdAt)),
                tx
                  .select({
                    orderId: orderItems.orderId,
                    distributable: sql<number>`sum(${allocations.distributableMinor})::bigint`,
                    company: sql<number>`sum(${allocations.companyMinor})::bigint`,
                    lines: sql<string>`json_agg(${allocations.lines})`,
                  })
                  .from(allocations)
                  .innerJoin(orderItems, eq(orderItems.id, allocations.orderItemId))
                  .where(inArray(orderItems.orderId, ids))
                  .groupBy(orderItems.orderId),
              ]);
        const latestPayment = new Map<string, Payment>();
        for (const p of paymentRows) if (!latestPayment.has(p.orderId)) latestPayment.set(p.orderId, p);
        const allocationByOrder = new Map(allocationRows.map((a) => [a.orderId, a] as const));
        const items: OrderAdminRow[] = page.map((r) => {
          const o = r.order;
          const p = latestPayment.get(o.id) ?? null;
          const a = allocationByOrder.get(o.id);
          const partnerIds = new Set<string>();
          if (a !== undefined) {
            const groups = (typeof a.lines === "string" ? (JSON.parse(a.lines) as { partner_id: string }[][]) : (a.lines as unknown as { partner_id: string }[][]));
            for (const g of groups) for (const l of g) partnerIds.add(l.partner_id);
          }
          return {
            ...toSummary(o, r.itemCount),
            customer: {
              userId: o.userId,
              name: o.billingSnapshot.name || o.clientName || "",
              email: o.billingSnapshot.email || o.clientEmail || "",
            },
            paymentStatus: p?.status ?? null,
            shortfallMinor: p?.bankShortfallMinor ?? null,
            customerCreditMinor: p?.customerCreditMinor ?? null,
            ...(a === undefined
              ? {}
              : {
                  allocation: {
                    distributableMinor: Number.parseInt(String(a.distributable), 10),
                    companyMinor: Number.parseInt(String(a.company), 10),
                    partnerCount: partnerIds.size,
                  },
                }),
            splitApprovalRequestId: o.splitApprovalRequestId,
          };
        });
        const last = page[page.length - 1];
        const lastValue = last === undefined ? null : field === "total" ? last.order.totalMinor : field === "status" ? last.order.status : last.order.createdAt.toISOString();
        return {
          items,
          nextCursor: rows.length > input.limit && last !== undefined ? encodeCursor(lastValue, last.order.id) : null,
        };
      }, undefined, deps.db);
    },

    async getOrderAdmin(ctx, input: GetOrderAdminInput): Promise<OrderDetail> {
      return withTx(async (tx) => {
        const scope = orderScope(ctx);
        const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (order === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
        if (scope !== "all") {
          const [visible] = await tx
            .select({ id: orderItems.id })
            .from(orderItems)
            .where(and(eq(orderItems.orderId, order.id), sql`${orderItems.productId} in ${partnerProductsSubquery(scope.partnerId)}`))
            .limit(1);
          if (visible === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
        }
        return buildDetail(order, tx);
      }, undefined, deps.db);
    },

    // -- API-COM-07 / API-COM-14 ------------------------------------------------------------------
    createManualOrder(ctx, input: CreateManualOrderInput, outerTx): Promise<CreateManualOrderResult> {
      return createManualOrderImpl(service, ctx, input, outerTx);
    },
    applyProjectOrderSplit(payload: ProjectOrderSplitPayload, approvalRequestId: string, tx: TxCtx): Promise<void> {
      return applyProjectOrderSplitImpl(service, payload, approvalRequestId, tx);
    },

    // -- internal transitions ---------------------------------------------------------------------
    async markPaid(orderId, paidAt, tx): Promise<Order> {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
      if (order === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
      assertTransition(order.status, "paid", order.orderNo);
      const [updated] = await tx
        .update(orders)
        .set({ status: "paid", paidAt, updatedAt: paidAt })
        .where(and(eq(orders.id, orderId), eq(orders.status, "pending_payment")))
        .returning();
      if (updated === undefined) throw new AppError(ErrorCode.CONFLICT);
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      if (order.userId !== null) {
        for (const item of items) {
          if (item.offeringId === null) continue;
          const [offering] = await tx.select({ purchaseModel: offerings.purchaseModel }).from(offerings).where(eq(offerings.id, item.offeringId)).limit(1);
          if (offering?.purchaseModel !== "one_time") continue;
          await tx
            .insert(userOfferingPurchases)
            .values({ userId: order.userId, offeringId: item.offeringId, orderId })
            .onConflictDoNothing();
        }
      }
      if (order.couponId !== null) {
        await deps.coupons.redeemForOrder(order.couponId, orderId, order.userId, tx);
      }
      if (order.customQuoteId !== null) {
        await deps.quotes.markPaid(order.customQuoteId, tx);
      }
      return updated;
    },

    async evaluateFulfilled(orderId, tx): Promise<{ fulfilled: boolean }> {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (order === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
      if (order.status === "fulfilled") return { fulfilled: true };
      const ents = await tx
        .select({ id: entitlements.id, status: entitlements.status, deliveryType: entitlements.deliveryType })
        .from(entitlements)
        .innerJoin(orderItems, eq(orderItems.id, entitlements.orderItemId))
        .where(eq(orderItems.orderId, orderId));
      const serviceIds = ents.filter((e) => e.deliveryType === "service").map((e) => e.id);
      const progress =
        serviceIds.length === 0
          ? []
          : await tx
              .select({ entitlementId: serviceProgress.entitlementId, doneAt: serviceProgress.doneAt })
              .from(serviceProgress)
              .where(inArray(serviceProgress.entitlementId, serviceIds));
      const checklists = serviceIds.map((id) => ({
        complete: progress.filter((p) => p.entitlementId === id).every((p) => p.doneAt !== null),
      }));
      const fulfilled = isFulfilled({ entitlements: ents.map((e) => ({ status: e.status })), serviceChecklists: checklists });
      if (fulfilled && order.status === "paid") {
        await tx
          .update(orders)
          .set({ status: "fulfilled", fulfilledAt: now(), updatedAt: now() })
          .where(and(eq(orders.id, orderId), eq(orders.status, "paid")));
      }
      return { fulfilled };
    },

    async expirePendingOrders(at, outerTx): Promise<ExpireOrdersResult> {
      return withTx(async (tx) => {
        const expired = await tx
          .update(orders)
          .set({ status: "failed", updatedAt: at })
          .where(and(eq(orders.status, "pending_payment"), lt(orders.expiresAt, at)))
          .returning();
        const ids = expired.map((o) => o.id);
        if (ids.length === 0) return { expiredOrderIds: [] };
        await tx
          .update(payments)
          .set({ status: "failed", failureReason: "expired" })
          .where(and(inArray(payments.orderId, ids), inArray(payments.status, [...OPEN_PAYMENT_STATUSES])));
        for (const o of expired) {
          if (o.userId === null) continue;
          await deps.notifications.emit(
            o.userId,
            "payment.failed",
            { orderId: o.id, orderNo: o.orderNo, reason: "expired", totalMinor: o.totalMinor, currency: o.currency },
            ["inapp", "email"],
            tx,
          );
        }
        return { expiredOrderIds: ids };
      }, outerTx, deps.db);
    },
  };

  async function buildDetail(order: Order, tx: TxCtx): Promise<OrderDetail> {
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.createdAt));
    const paymentRows = await tx.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(asc(payments.createdAt));
    const [invoice] = await tx.select({ id: invoices.id, invoiceNo: invoices.invoiceNo }).from(invoices).where(eq(invoices.orderId, order.id)).limit(1);
    const ents =
      items.length === 0
        ? []
        : await tx
            .select({ id: entitlements.id, deliveryType: entitlements.deliveryType, status: entitlements.status })
            .from(entitlements)
            .where(inArray(entitlements.orderItemId, items.map((i) => i.id)));
    const offeringIds = items.map((i) => i.offeringId).filter((id): id is string => id !== null);
    const instructionDocs =
      offeringIds.length === 0
        ? []
        : await tx.select({ instructionsJson: offerings.instructionsJson }).from(offerings).where(inArray(offerings.id, offeringIds));
    const instructionsHtml = instructionDocs.map((d) => renderInstructionsHtml(d.instructionsJson)).filter((h) => h !== "").join("\n");
    return {
      order,
      items,
      payments: paymentRows.map(toPaymentView),
      ...(invoice === undefined ? {} : { invoice: { invoiceId: invoice.id, invoiceNo: invoice.invoiceNo } }),
      entitlements: ents.map((e) => ({ entitlementId: e.id, deliveryType: e.deliveryType, status: e.status })),
      instructionsHtml,
    };
  }

  return service;
}

// ---------------------------------------------------------------------------------------------
// Singleton (lazy deps: the commerce modules reference each other)
// ---------------------------------------------------------------------------------------------

import * as analyticsModule from "@/modules/analytics/service";
import * as approvalsModule from "@/modules/approvals/service";
import * as auditModule from "@/modules/audit/service";
import * as couponsModule from "@/modules/coupons/service";
import * as fxModule from "@/modules/fx/service";
import * as notificationsModule from "@/modules/notifications/service";
import * as paymentsModule from "@/modules/payments/service";
import * as quotesModule from "@/modules/quotes/service";
import * as settingsModule from "@/modules/settings/service";
import { analyticsFallback, fxFallback, lazyService, optionalSingleton, resolveSingleton, settingsFallback } from "./deps";

function isSettingsImplemented(): boolean {
  return optionalSingleton<SettingsService>(settingsModule, "settingsService") !== undefined;
}

/** Deps for every commerce singleton; resolved lazily so module-evaluation order does not matter. */
export const commerceDeps = {
  db: lazyService<TxRunner>(() => getDb()),
  approvals: lazyService(() =>
    resolveSingleton<ApprovalsService>(approvalsModule, "approvalsService", approvalsModule.createNotImplementedApprovalsService),
  ),
  audit: lazyService(() => resolveSingleton<AuditService>(auditModule, "auditService", auditModule.createNotImplementedAuditService)),
  notifications: lazyService(() =>
    resolveSingleton<NotificationsService>(notificationsModule, "notificationsService", notificationsModule.createNotImplementedNotificationsService),
  ),
  settings: lazyService<Pick<SettingsService, "load">>(() =>
    isSettingsImplemented() ? resolveSingleton<SettingsService>(settingsModule, "settingsService", settingsModule.createNotImplementedSettingsService) : settingsFallback,
  ),
  fx: lazyService<Pick<FxService, "getRate">>(() => optionalSingleton<FxService>(fxModule, "fxService") ?? fxFallback),
  analytics: lazyService<Pick<AnalyticsService, "recordServerEvent">>(
    () => optionalSingleton<AnalyticsService>(analyticsModule, "analyticsService") ?? analyticsFallback,
  ),
};

export const ordersService: OrdersModule = createOrdersService({
  ...commerceDeps,
  payments: lazyService(() => resolveSingleton<PaymentsService>(paymentsModule, "paymentsService", paymentsModule.createNotImplementedPaymentsService)),
  coupons: lazyService(() => resolveSingleton<CouponsService>(couponsModule, "couponsService", couponsModule.createNotImplementedCouponsService)),
  quotes: lazyService(() => resolveSingleton<QuotesService>(quotesModule, "quotesService", quotesModule.createNotImplementedQuotesService)),
});
