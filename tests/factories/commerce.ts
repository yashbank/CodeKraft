/**
 * Commerce factories (docs/05 §5): coupons, orders (+ items snapshotting the active ownership
 * version), payments (five states, frozen after `confirmed` — §12), custom quotes, invoices.
 * All amounts are integer minor units; tax uses `mulBps` from src/lib/money.ts.
 */
import { sql } from "drizzle-orm";

import { type Currency, mulBps } from "@/lib/money";
import type { User } from "../../drizzle/schema/auth";
import {
  type BillingSnapshot,
  type Coupon,
  type CustomQuote,
  type Order,
  type OrderItem,
  type OrderStatus,
  type Payment,
  type PaymentProviderKey,
  type PaymentStatus,
  type QuoteStatus,
  coupons,
  customQuotes,
  orderItems,
  orders,
  payments,
} from "../../drizzle/schema/commerce";
import { type Invoice, type InvoiceLine, invoices } from "../../drizzle/schema/invoices";
import { type FactoryDb, addDays, nextSeq, one, seqLabel, toFactoryDb } from "./context";
import { type OfferingWithPrices, createOffering, findOffering, priceIn } from "./offerings";
import { findActiveOwnership } from "./ownership";
import { createAdmin, createUser } from "./users";

// ---------------------------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------------------------

export interface CreateCouponOptions {
  code?: string;
  kind?: Coupon["kind"];
  /** bps for `percent` (default 1000 = 10 %), minor units for `fixed` (default ₹500.00). */
  value?: number;
  currency?: Currency | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxRedemptions?: number | null;
  firstPurchaseOnly?: boolean;
  productIds?: string[] | null;
  active?: boolean;
  createdBy?: string | null;
}

export async function createCoupon(
  opts: CreateCouponOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<Coupon> {
  const kind = opts.kind ?? "percent";
  return one(
    await db
      .insert(coupons)
      .values({
        code: opts.code ?? `CODE${String(nextSeq()).padStart(4, "0")}`,
        kind,
        value: opts.value ?? (kind === "percent" ? 1000 : 50_000),
        currency: opts.currency === undefined ? (kind === "fixed" ? "INR" : null) : opts.currency,
        startsAt: opts.startsAt ?? null,
        endsAt: opts.endsAt ?? null,
        maxRedemptions: opts.maxRedemptions ?? null,
        firstPurchaseOnly: opts.firstPurchaseOnly ?? false,
        productIds: opts.productIds ?? null,
        active: opts.active ?? true,
        createdBy: opts.createdBy ?? null,
      })
      .returning(),
    "coupons",
  );
}

// ---------------------------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------------------------

export interface CreateOrderOptions {
  /** Buyer; default a new verified customer. */
  user?: Pick<User, "id" | "email" | "name">;
  /** Offering for the single default line; default a new one-time download offering. */
  offering?: OfferingWithPrices;
  offeringId?: string;
  quantity?: number;
  status?: OrderStatus;
  currency?: Currency;
  couponId?: string | null;
  discountMinor?: number;
  /** Applied to (subtotal − discount) with half-up rounding; default 0. */
  taxRateBps?: number;
  /** `numeric(18,8)` as a decimal string; default `"1"` for INR. */
  fxRateToInr?: string;
  billingSnapshot?: BillingSnapshot;
  /** `false` creates the order header only (no `order_items`). */
  withItem?: boolean;
  createdBy?: string | null;
  type?: Order["type"];
}

export type OrderWithItems = Order & { items: OrderItem[] };

const ORDER_NO = sql`'CK-ORD-' || lpad(nextval('order_no_seq')::text, 6, '0')`;

function statusTimestamps(status: OrderStatus, now: Date) {
  const paidLike = ["paid", "fulfilled", "refunded", "partially_refunded"].includes(status);
  return {
    paidAt: paidLike ? now : null,
    fulfilledAt: status === "fulfilled" ? now : null,
    cancelledAt: status === "cancelled" ? now : null,
    refundedAt: status === "refunded" || status === "partially_refunded" ? now : null,
    expiresAt: status === "pending_payment" ? addDays(now, 7) : null,
  };
}

export async function createOrder(
  opts: CreateOrderOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<OrderWithItems> {
  const user = opts.user ?? (await createUser({ emailVerified: true }, db));
  const currency = opts.currency ?? "INR";
  const withItem = opts.withItem !== false;
  let offering: OfferingWithPrices | undefined = opts.offering;
  if (withItem && offering === undefined) {
    offering =
      opts.offeringId === undefined
        ? await createOffering({}, db)
        : ((await findOffering(opts.offeringId, db)) ?? undefined);
    if (offering === undefined)
      throw new Error(`createOrder: offering ${opts.offeringId} not found`);
  }

  const quantity = opts.quantity ?? 1;
  const unitMinor = offering === undefined ? 0 : priceIn(offering, currency).amountMinor;
  const subtotalMinor = unitMinor * quantity;
  const discountMinor = opts.discountMinor ?? 0;
  const taxRateBps = opts.taxRateBps ?? 0;
  const taxMinor = mulBps(
    { amountMinor: subtotalMinor - discountMinor, currency },
    taxRateBps,
  ).amountMinor;
  const totalMinor = subtotalMinor - discountMinor + taxMinor;
  const status = opts.status ?? "pending_payment";
  const now = new Date();

  const order = one(
    await db
      .insert(orders)
      .values({
        orderNo: ORDER_NO,
        type: opts.type ?? "product",
        userId: user.id,
        status,
        currency,
        subtotalMinor,
        discountMinor,
        taxMinor,
        totalMinor,
        couponId: opts.couponId ?? null,
        billingSnapshot: opts.billingSnapshot ?? {
          name: user.name,
          email: user.email,
          country: "IN",
        },
        taxRateBps,
        taxSnapshot:
          taxRateBps > 0 ? { rate_bps: taxRateBps, kind: "igst", buyer_country: "IN" } : null,
        fxRateToInr: opts.fxRateToInr ?? "1",
        createdBy: opts.createdBy ?? null,
        ...statusTimestamps(status, now),
      })
      .returning(),
    "orders",
  );

  const items: OrderItem[] = [];
  if (offering !== undefined) {
    items.push(
      await createOrderItem(
        { orderId: order.id, offering, quantity, unitMinor, discountMinor, taxMinor },
        db,
      ),
    );
  }
  return { ...order, items };
}

export interface CreateOrderItemOptions {
  orderId: string;
  offering?: OfferingWithPrices;
  offeringId?: string;
  quantity?: number;
  /** Default: the offering's price in `currency`. */
  unitMinor?: number;
  currency?: Currency;
  discountMinor?: number;
  taxMinor?: number;
  description?: string;
  /** Default: the product's active ownership version (null when none). */
  ownershipId?: string | null;
}

export async function createOrderItem(
  opts: CreateOrderItemOptions,
  db: FactoryDb = toFactoryDb(),
): Promise<OrderItem> {
  let offering = opts.offering;
  if (offering === undefined) {
    offering =
      opts.offeringId === undefined
        ? await createOffering({}, db)
        : ((await findOffering(opts.offeringId, db)) ?? undefined);
    if (offering === undefined)
      throw new Error(`createOrderItem: offering ${opts.offeringId} not found`);
  }
  const quantity = opts.quantity ?? 1;
  const unitMinor = opts.unitMinor ?? priceIn(offering, opts.currency ?? "INR").amountMinor;
  const discountMinor = opts.discountMinor ?? 0;
  const taxMinor = opts.taxMinor ?? 0;
  const ownershipId =
    opts.ownershipId === undefined
      ? ((await findActiveOwnership(offering.productId, db))?.id ?? null)
      : opts.ownershipId;
  return one(
    await db
      .insert(orderItems)
      .values({
        orderId: opts.orderId,
        offeringId: offering.id,
        productId: offering.productId,
        description: opts.description ?? offering.name,
        quantity,
        unitMinor,
        discountMinor,
        taxMinor,
        totalMinor: unitMinor * quantity - discountMinor + taxMinor,
        ownershipId,
      })
      .returning(),
    "order_items",
  );
}

// ---------------------------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------------------------

export interface CreatePaymentOptions {
  order: Pick<Order, "id" | "totalMinor" | "currency">;
  status?: PaymentStatus;
  provider?: PaymentProviderKey;
  /** Default: the order total when `confirmed`/`refunded`, null otherwise. */
  amountReceivedMinor?: number | null;
  amountRefundedMinor?: number | null;
  /** Default: a new admin when the status needs one. */
  confirmedBy?: string | null;
  customerReference?: string | null;
  failureReason?: string | null;
}

export async function createPayment(
  opts: CreatePaymentOptions,
  db: FactoryDb = toFactoryDb(),
): Promise<Payment> {
  const status = opts.status ?? "confirmed";
  const settled = status === "confirmed" || status === "refunded";
  const due = opts.order.totalMinor;
  const received =
    opts.amountReceivedMinor === undefined ? (settled ? due : null) : opts.amountReceivedMinor;
  const now = new Date();
  const confirmedBy = settled
    ? (opts.confirmedBy ?? (await createAdmin({}, db)).id)
    : (opts.confirmedBy ?? null);
  const provider = opts.provider ?? "manual_upi";
  const reference =
    opts.customerReference ??
    (status === "initiated" ? null : `UTR${String(nextSeq()).padStart(8, "0")}`);
  return one(
    await db
      .insert(payments)
      .values({
        orderId: opts.order.id,
        provider,
        status,
        amountDueMinor: due,
        amountReceivedMinor: received,
        bankShortfallMinor: received === null ? null : Math.max(0, due - received),
        customerCreditMinor: received === null ? null : Math.max(0, received - due),
        amountRefundedMinor:
          opts.amountRefundedMinor ?? (status === "refunded" ? (received ?? due) : null),
        currency: opts.order.currency,
        instructions:
          provider === "manual_upi"
            ? {
                method: "manual_upi",
                vpa: "codekraft@upi",
                payeeName: "CodeKraft",
                amountMinor: due,
                currency: opts.order.currency,
                upiUri: `upi://pay?pa=codekraft@upi&am=${(due / 100).toFixed(2)}`,
                qrDataUrl: "data:image/png;base64,",
                reference: reference ?? "",
              }
            : null,
        customerReference: reference,
        customerSubmittedAt: status === "initiated" ? null : now,
        confirmedBy,
        confirmedAt: settled ? now : null,
        failureReason: opts.failureReason ?? (status === "failed" ? "factory: declined" : null),
      })
      .returning(),
    "payments",
  );
}

// ---------------------------------------------------------------------------------------------
// Custom quotes (D-520)
// ---------------------------------------------------------------------------------------------

export interface CreateQuoteOptions {
  /** Default: a new customer. */
  customerId?: string;
  offeringId?: string | null;
  title?: string;
  description?: string | null;
  currency?: Currency;
  amountMinor?: number;
  status?: QuoteStatus;
  expiresAt?: Date | null;
  orderId?: string | null;
  createdBy?: string | null;
}

export async function createQuote(
  opts: CreateQuoteOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<CustomQuote> {
  const customerId = opts.customerId ?? (await createUser({ emailVerified: true }, db)).id;
  const label = seqLabel("quote");
  return one(
    await db
      .insert(customQuotes)
      .values({
        customerId,
        offeringId: opts.offeringId ?? null,
        title: opts.title ?? `Custom build ${label.slice(-4)}`,
        description: opts.description ?? null,
        currency: opts.currency ?? "INR",
        amountMinor: opts.amountMinor ?? 5_000_000,
        token: `${label}-token`,
        expiresAt: opts.expiresAt === undefined ? addDays(new Date(), 14) : opts.expiresAt,
        status: opts.status ?? "sent",
        orderId: opts.orderId ?? null,
        createdBy: opts.createdBy ?? null,
      })
      .returning(),
    "custom_quotes",
  );
}

// ---------------------------------------------------------------------------------------------
// Invoices (append-only, gapless per FY — BR-16)
// ---------------------------------------------------------------------------------------------

/** Indian financial year label for a date: April 2026 → `2026-27`. */
export function financialYear(date: Date): string {
  const y = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export interface CreateInvoiceOptions {
  order: OrderWithItems | Order;
  /** Default: the factory sequence (unique per process; the real issuer row-locks invoice_sequences). */
  seq?: number;
  fy?: string;
  issuedAt?: Date;
  lines?: InvoiceLine[];
  pdfMediaId?: string | null;
}

export async function createInvoice(
  opts: CreateInvoiceOptions,
  db: FactoryDb = toFactoryDb(),
): Promise<Invoice> {
  const issuedAt = opts.issuedAt ?? new Date();
  const fy = opts.fy ?? financialYear(issuedAt);
  const seq = opts.seq ?? nextSeq();
  const order = opts.order;
  const items = "items" in order ? order.items : [];
  const lines: InvoiceLine[] =
    opts.lines ??
    items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_minor: i.unitMinor,
      discount_minor: i.discountMinor,
      tax_minor: i.taxMinor,
      total_minor: i.totalMinor,
    }));
  return one(
    await db
      .insert(invoices)
      .values({
        invoiceNo: `CK/${fy}/${String(seq).padStart(4, "0")}`,
        orderId: order.id,
        fy,
        seq,
        issuedAt,
        sellerSnapshot: { name: "CodeKraft", address: "Pune, MH, India" },
        buyerSnapshot: order.billingSnapshot,
        lines,
        subtotalMinor: order.subtotalMinor,
        discountMinor: order.discountMinor,
        taxMinor: order.taxMinor,
        totalMinor: order.totalMinor,
        currency: order.currency,
        gstBreakdown:
          order.taxRateBps > 0 ? { igst_minor: order.taxMinor, rate_bps: order.taxRateBps } : null,
        pdfMediaId: opts.pdfMediaId ?? null,
      })
      .returning(),
    "invoices",
  );
}
