/**
 * Commerce (docs/05 §5): coupons, custom quotes, orders, order items, one-time purchase guard,
 * payments and refunds. Money is integer minor units in `bigint` with a `char(3)` currency
 * (MASTER_SPEC §4.8); FX to INR is `numeric(18,8)` (D-515).
 *
 * Cross-domain FKs to domain A (offerings, products, product_ownerships) are wired here (P2.4):
 * order lines are financial history → `restrict`; quote/purchase-guard links follow their parent.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { approvalRequests } from "./approvals";
import { citext, users } from "./auth";
import { products } from "./catalog";
import { creditNotes } from "./invoices";
import { offerings } from "./offerings";
import { productOwnerships } from "./ownership";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
/** Integer minor units (paise/cents). Never floats. */
const money = (name: string) => bigint(name, { mode: "number" });
const currency = (name = "currency") => char(name, { length: 3 });

// ---------------------------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------------------------

export const couponKind = pgEnum("coupon_kind", ["percent", "fixed"]);

export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "paid",
  "expired",
  "cancelled",
]);

export const orderType = pgEnum("order_type", ["product", "project"]);

/** Seven order states (docs/05 T-orders). */
export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "fulfilled",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
]);

/**
 * Payment method keys (docs/06 §4.1 `PaymentMethodKey`). Append-only: `manual_upi`/`manual_bank`
 * persist forever in historical payments; gateway keys are V1.1 behind flags (D-501).
 */
export const paymentProvider = pgEnum("payment_provider", [
  "manual_upi",
  "manual_bank",
  "razorpay",
  "stripe",
  "paypal",
]);

/** Five payment states; `confirmed → refunded` is the only post-confirmation transition (§12). */
export const paymentStatus = pgEnum("payment_status", [
  "initiated",
  "submitted",
  "confirmed",
  "failed",
  "refunded",
]);

// ---------------------------------------------------------------------------------------------
// JSON shapes
// ---------------------------------------------------------------------------------------------

/** docs/05 T-orders `billing_snapshot` (keys as stored; docs/06 API input is camelCase). */
export interface BillingSnapshot {
  name: string;
  email: string;
  country: string;
  company?: string | null;
  address?: string | null;
  gst_number?: string | null;
}

/** docs/05 T-orders `tax_snapshot` — the tax rule applied at order time (docs/06 §1.10). */
export interface TaxSnapshot {
  rate_bps: number;
  seller_state?: string | null;
  buyer_state?: string | null;
  buyer_country?: string | null;
  gst_number?: string | null;
  /** 'cgst_sgst' | 'igst' | 'none' | 'export' */
  kind: string;
}

/**
 * docs/05 T-order_items `split_snapshot` for project lines — dual-approved via
 * `project_order.split`, then used by ledger posting exactly like an ownership version.
 */
export interface SplitSnapshot {
  company_cut_bps: number;
  lines: { partner_id: string; share_bps: number }[];
}

/** docs/06 §2.4 `UpiInstructions | BankInstructions` as persisted on the payment. */
export type PaymentInstructions =
  | {
      method: "manual_upi";
      vpa: string;
      payeeName: string;
      amountMinor: number;
      currency: string;
      upiUri: string;
      qrDataUrl: string;
      reference: string;
    }
  | {
      method: "manual_bank";
      accountName: string;
      accountNumber: string;
      ifsc: string;
      bankName: string;
      branch?: string | null;
      swift?: string | null;
      amountMinor: number;
      currency: string;
      reference: string;
    }
  | { method: "razorpay" | "stripe" | "paypal"; [key: string]: unknown };

// ---------------------------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------------------------

/** Backs `orders.order_no` = 'CK-ORD-' || lpad(nextval, 6, '0') (docs/05 T-orders). */
export const orderNoSeq = pgSequence("order_no_seq", { startWith: 1, increment: 1 });

// ---------------------------------------------------------------------------------------------
// Coupons (T-coupons)
// ---------------------------------------------------------------------------------------------

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    code: citext("code").notNull().unique(),
    kind: couponKind("kind").notNull(),
    /** bps for `percent`, minor units for `fixed`. */
    value: integer("value").notNull(),
    /** Required for `fixed`, null for `percent`. */
    currency: currency(),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    maxRedemptions: integer("max_redemptions"),
    redemptionsCount: integer("redemptions_count").notNull().default(0),
    firstPurchaseOnly: boolean("first_purchase_only").notNull().default(false),
    /** Restrict to these products; null = any. FK-less array by design (docs/05). */
    productIds: uuid("product_ids").array(),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("coupons_active_idx").on(t.active, t.endsAt)],
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("coupon_redemptions_coupon_order_uq").on(t.couponId, t.orderId),
    index("coupon_redemptions_user_idx").on(t.userId),
    index("coupon_redemptions_order_idx").on(t.orderId),
  ],
);

// ---------------------------------------------------------------------------------------------
// Custom quotes (T-custom_quotes, D-520)
// ---------------------------------------------------------------------------------------------

export const customQuotes = pgTable(
  "custom_quotes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id),
    offeringId: uuid("offering_id").references(() => offerings.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    currency: currency().notNull(),
    amountMinor: money("amount_minor").notNull(),
    /** Opaque acceptance token in the quote link. */
    token: text("token").notNull().unique(),
    expiresAt: ts("expires_at"),
    status: quoteStatus("status").notNull().default("draft"),
    orderId: uuid("order_id").references((): AnyPgColumn => orders.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("custom_quotes_customer_idx").on(t.customerId, t.createdAt),
    index("custom_quotes_status_idx").on(t.status, t.expiresAt),
    index("custom_quotes_offering_idx").on(t.offeringId),
    index("custom_quotes_order_idx").on(t.orderId),
  ],
);

// ---------------------------------------------------------------------------------------------
// Orders (T-orders)
// ---------------------------------------------------------------------------------------------

export const orders = pgTable(
  "orders",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** CK-ORD-000001 — from `order_no_seq`. */
    orderNo: text("order_no").notNull().unique(),
    type: orderType("type").notNull().default("product"),
    /** Null for project orders billed to a client without an account (client_* instead). */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    clientCompany: text("client_company"),
    status: orderStatus("status").notNull().default("pending_payment"),
    currency: currency().notNull(),
    subtotalMinor: money("subtotal_minor").notNull(),
    discountMinor: money("discount_minor").notNull().default(0),
    taxMinor: money("tax_minor").notNull().default(0),
    totalMinor: money("total_minor").notNull(),
    couponId: uuid("coupon_id").references(() => coupons.id),
    customQuoteId: uuid("custom_quote_id").references((): AnyPgColumn => customQuotes.id),
    /** Project orders: the `project_order.split` request; must be `applied` before invoice/payment (BR-05). */
    splitApprovalRequestId: uuid("split_approval_request_id").references(() => approvalRequests.id),
    billingSnapshot: jsonb("billing_snapshot").$type<BillingSnapshot>().notNull(),
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    taxSnapshot: jsonb("tax_snapshot").$type<TaxSnapshot>(),
    fxRateToInr: numeric("fx_rate_to_inr", { precision: 18, scale: 8 }).notNull(),
    /** pending_payment + 7 d; expiry cron uses (status, expires_at). */
    expiresAt: ts("expires_at"),
    paidAt: ts("paid_at"),
    fulfilledAt: ts("fulfilled_at"),
    cancelledAt: ts("cancelled_at"),
    refundedAt: ts("refunded_at"),
    /** Admin for manual orders (API-COM-07); null for self-service checkout. */
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("orders_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("orders_status_expires_idx").on(t.status, t.expiresAt),
    index("orders_coupon_idx").on(t.couponId),
    index("orders_custom_quote_idx").on(t.customQuoteId),
    index("orders_split_approval_idx").on(t.splitApprovalRequestId),
    index("orders_created_by_idx").on(t.createdBy),
  ],
);

// ---------------------------------------------------------------------------------------------
// Order items (T-order_items)
// ---------------------------------------------------------------------------------------------

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Null for project lines. */
    offeringId: uuid("offering_id").references(() => offerings.id, { onDelete: "restrict" }),
    /** Null for project lines. */
    productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }),
    /** Free-form for project lines; offering title snapshot for product lines. */
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitMinor: money("unit_minor").notNull(),
    discountMinor: money("discount_minor").notNull().default(0),
    taxMinor: money("tax_minor").notNull().default(0),
    totalMinor: money("total_minor").notNull(),
    /**
     * Product lines: ownership version captured at order creation, re-validated at confirm time
     * (docs/06 §4.2) and frozen once allocated — trigger in drizzle/custom (P2.4).
     */
    ownershipId: uuid("ownership_id").references(() => productOwnerships.id, {
      onDelete: "restrict",
    }),
    /** Project lines: approved via `project_order.split` (MASTER_SPEC §7). */
    splitSnapshot: jsonb("split_snapshot").$type<SplitSnapshot>(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_offering_idx").on(t.offeringId),
    index("order_items_product_idx").on(t.productId),
    index("order_items_ownership_idx").on(t.ownershipId),
  ],
);

// ---------------------------------------------------------------------------------------------
// One-time purchase guard (BR-10) — populated on `paid` for one_time offerings
// ---------------------------------------------------------------------------------------------

export const userOfferingPurchases = pgTable(
  "user_offering_purchases",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    offeringId: uuid("offering_id")
      .notNull()
      .references(() => offerings.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("user_offering_purchases_user_offering_uq").on(t.userId, t.offeringId),
    index("user_offering_purchases_offering_idx").on(t.offeringId),
    index("user_offering_purchases_order_idx").on(t.orderId),
  ],
);

// ---------------------------------------------------------------------------------------------
// Payments (T-payments)
// ---------------------------------------------------------------------------------------------

export const payments = pgTable(
  "payments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: paymentProvider("provider").notNull(),
    status: paymentStatus("status").notNull().default("initiated"),
    amountDueMinor: money("amount_due_minor").notNull(),
    amountReceivedMinor: money("amount_received_minor"),
    /** max(0, due − received) — spread across items at posting (docs/06 §4.2). */
    bankShortfallMinor: money("bank_shortfall_minor"),
    /** Running total of refunds; the only mutable column after `confirmed` (§12). */
    amountRefundedMinor: money("amount_refunded_minor"),
    /** max(0, received − due) — shown to admins, never allocated (MASTER_SPEC §7 "Overpayment"). */
    customerCreditMinor: money("customer_credit_minor"),
    currency: currency().notNull(),
    /** UPI vpa / QR data URL / bank details as rendered to the customer. */
    instructions: jsonb("instructions").$type<PaymentInstructions>(),
    /** UTR / transaction id typed by the customer (API-PAY-02). */
    customerReference: text("customer_reference"),
    customerSubmittedAt: ts("customer_submitted_at"),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: ts("confirmed_at"),
    failureReason: text("failure_reason"),
    providerPayload: jsonb("provider_payload").$type<Record<string, unknown>>(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_status_created_idx").on(t.status, t.createdAt),
    index("payments_confirmed_by_idx").on(t.confirmedBy),
  ],
);

// ---------------------------------------------------------------------------------------------
// Refunds (T-refunds) — executed only through an applied `refund.issue` approval
// ---------------------------------------------------------------------------------------------

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    amountMinor: money("amount_minor").notNull(),
    currency: currency().notNull(),
    reason: text("reason").notNull(),
    approvalRequestId: uuid("approval_request_id").references(() => approvalRequests.id),
    /** Set when the credit note is issued (API-PAY-06); circular with credit_notes.refund_id. */
    creditNoteId: uuid("credit_note_id").references((): AnyPgColumn => creditNotes.id),
    executedBy: uuid("executed_by").references(() => users.id),
    executedAt: ts("executed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("refunds_order_idx").on(t.orderId),
    index("refunds_payment_idx").on(t.paymentId),
    index("refunds_approval_idx").on(t.approvalRequestId),
    index("refunds_credit_note_idx").on(t.creditNoteId),
  ],
);

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type CustomQuote = typeof customQuotes.$inferSelect;
export type NewCustomQuote = typeof customQuotes.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type UserOfferingPurchase = typeof userOfferingPurchases.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
export type OrderType = (typeof orderType.enumValues)[number];
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type PaymentProviderKey = (typeof paymentProvider.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type QuoteStatus = (typeof quoteStatus.enumValues)[number];
