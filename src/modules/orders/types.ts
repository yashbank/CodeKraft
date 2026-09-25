/**
 * Orders — Zod input schemas and output types (docs/06 §2.3 API-COM-01..07, API-COM-14).
 *
 * Domain-B shared primitives (`zUuid`, `zMoney`, `zBps`, list params) are the canonical set in
 * `src/modules/_shared/zod.ts` (P2.8), re-exported here under the domain-B names so the P2.6
 * public surface is unchanged (orders is the root entity of commerce: orders ← payments /
 * coupons / quotes / invoices / finance ← approvals).
 *
 * Conventions (docs/06 §1.3, §1.9): inputs are `.strict()`; strings are trimmed; money is
 * `{ amountMinor, currency }` in integer minor units; ids are UUIDs; dates are `YYYY-MM-DD` and
 * timestamps ISO-8601.
 */
import { z } from "zod";
import type { Currency } from "@/lib/money";
import {
  bpsSchema as zBps,
  currencySchema as zCurrency,
  isoDateSchema as zIsoDate,
  listParams as zListParams,
  minorUnitsSchema as zMinor,
  moneySchema as zMoney,
  positiveMinorUnitsSchema as zPositiveMinor,
  trimmedString as zTrimmed,
  uuidSchema as zUuid,
} from "@/modules/_shared/zod";
import type {
  BillingSnapshot,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  Payment,
  PaymentStatus,
  SplitSnapshot,
} from "../../../drizzle/schema/commerce";
import type { PaymentInstructions } from "@/modules/payments/provider";

// ---------------------------------------------------------------------------------------------
// Shared primitives (docs/06 §1.3, §1.8, §1.9) — canonical set in `_shared/zod.ts`
// ---------------------------------------------------------------------------------------------

export {
  uuidSchema as zUuid,
  currencySchema as zCurrency,
  minorUnitsSchema as zMinor,
  positiveMinorUnitsSchema as zPositiveMinor,
  signedMinorUnitsSchema as zSignedMinor,
  moneySchema as zMoney,
  bpsSchema as zBps,
  isoDateSchema as zIsoDate,
  isoDateTimeSchema as zIsoTimestamp,
  trimmedString as zTrimmed,
  listParams as zListParams,
  type ListResult,
} from "@/modules/_shared/zod";
export const zEmail = z.email().trim().max(254);
/** ISO-3166 alpha-2, upper-case. */
export const zCountry = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "ISO-3166 alpha-2 country code");
/** Financial-year label `2026-27` (BR-16). */
export const zFyLabel = z.string().regex(/^\d{4}-\d{2}$/, "financial year label like 2026-27");
export const zPublicOrderNo = z
  .string()
  .regex(/^CK-ORD-\d{6,}$/, "order number like CK-ORD-000001");

export type Money = z.infer<typeof zMoney>;
export type { Currency };

/** Date-range filter fragment shared by admin lists. */
export const zDateRange = {
  dateFrom: zIsoDate.optional(),
  dateTo: zIsoDate.optional(),
};

// ---------------------------------------------------------------------------------------------
// Enums mirrored from drizzle/schema/commerce (kept as const tuples so Zod can enumerate them)
// ---------------------------------------------------------------------------------------------

export const ORDER_TYPES = ["product", "project"] as const satisfies readonly OrderType[];
export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "fulfilled",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const satisfies readonly OrderStatus[];
/** Release-1 methods a customer may pick at checkout (D-501). */
export const MANUAL_PAYMENT_METHODS = ["manual_upi", "manual_bank"] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];
export const zManualPaymentMethod = z.enum(MANUAL_PAYMENT_METHODS);

/** Pending orders expire 7 days after creation (BR-10). */
export const ORDER_EXPIRY_DAYS = 7;

/**
 * Order state machine (docs/03 state machines, MASTER_SPEC §7 "Order failed" / "Order cancelled").
 * `fulfilled` is reached by the fulfilment rule (`OrdersService.evaluateFulfilled`).
 */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> =
  Object.freeze({
    pending_payment: ["paid", "failed", "cancelled"],
    paid: ["fulfilled", "refunded", "partially_refunded"],
    fulfilled: ["refunded", "partially_refunded"],
    failed: [],
    cancelled: [],
    refunded: [],
    partially_refunded: ["refunded"],
  });

// ---------------------------------------------------------------------------------------------
// Billing (D-410) and project split snapshot (MASTER_SPEC §7 "Project order splits")
// ---------------------------------------------------------------------------------------------

export const zBilling = z
  .object({
    name: zTrimmed(1, 120),
    email: zEmail,
    country: zCountry,
    company: zTrimmed(0, 120).optional(),
    address: zTrimmed(0, 500).optional(),
    gstNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "GSTIN format")
      .optional(),
  })
  .strict();
export type BillingInput = z.infer<typeof zBilling>;

export const zSplitLine = z.object({ partnerId: zUuid, shareBps: zBps }).strict();

/** Shares must sum to exactly 10 000 bps and name each partner once (FI-03 for project lines). */
export const zSplitSnapshot = z
  .object({
    companyCutBps: zBps,
    lines: z.array(zSplitLine).min(1).max(20),
  })
  .strict()
  .superRefine((snap, ctx) => {
    const sum = snap.lines.reduce((acc, l) => acc + l.shareBps, 0);
    if (sum !== 10_000) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: `share_bps must sum to 10000, got ${String(sum)}`,
      });
    }
    const seen = new Set<string>();
    snap.lines.forEach((l, i) => {
      if (seen.has(l.partnerId)) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", i, "partnerId"],
          message: "duplicate partner in split",
        });
      }
      seen.add(l.partnerId);
    });
  });
export type SplitSnapshotInput = z.infer<typeof zSplitSnapshot>;

/** API input (camelCase) → persisted `order_items.split_snapshot` (snake_case). */
export function toSplitSnapshot(input: SplitSnapshotInput): SplitSnapshot {
  return {
    company_cut_bps: input.companyCutBps,
    lines: input.lines.map((l) => ({ partner_id: l.partnerId, share_bps: l.shareBps })),
  };
}

// ---------------------------------------------------------------------------------------------
// API-COM-01 previewCheckout (query)
// ---------------------------------------------------------------------------------------------

export const zCouponCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/, "coupon code");

export const previewCheckoutInput = z
  .object({ offeringId: zUuid, couponCode: zCouponCode.optional() })
  .strict();
export type PreviewCheckoutInput = z.infer<typeof previewCheckoutInput>;

export interface CheckoutLine {
  description: string;
  unitMinor: number;
  quantity: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface CheckoutPreview {
  offering: { id: string; title: string; purchaseModel: string; deliveryType: string };
  product: { id: string; slug: string; title: string; taxEnabled: boolean; isRefundable: boolean };
  lines: CheckoutLine[];
  /** All in base currency (D-502). */
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  /** Converted for the visitor's display currency (D-111). */
  displayTotal: Money;
  taxRateBps: number;
  coupon?: { code: string; kind: "percent" | "fixed"; value: number };
  enabledMethods: ManualPaymentMethod[];
  warnings: string[];
}

// ---------------------------------------------------------------------------------------------
// API-COM-02 createOrder — single-offering checkout ("Buy now", MASTER_SPEC §7 "Cart")
// ---------------------------------------------------------------------------------------------

export const createOrderInput = z
  .object({
    offeringId: zUuid,
    couponCode: zCouponCode.optional(),
    paymentMethod: zManualPaymentMethod,
    billing: zBilling,
  })
  .strict();
export type CreateOrderInput = z.infer<typeof createOrderInput>;

export interface OrderPaymentHandle {
  paymentId: string;
  method: ManualPaymentMethod;
  instructions: PaymentInstructions;
}

/** Idempotent per `(userId, offeringId)` while an order is `pending_payment` (docs/06 §1.5). */
export interface CreateOrderResult {
  orderId: string;
  orderNo: string;
  payment: OrderPaymentHandle;
  expiresAt: string;
}

// ---------------------------------------------------------------------------------------------
// API-COM-03 cancelMyOrder, API-COM-04 retryPayment
// ---------------------------------------------------------------------------------------------

export const cancelMyOrderInput = z.object({ orderId: zUuid }).strict();
export type CancelMyOrderInput = z.infer<typeof cancelMyOrderInput>;

export const retryPaymentInput = z
  .object({ orderId: zUuid, paymentMethod: zManualPaymentMethod })
  .strict();
export type RetryPaymentInput = z.infer<typeof retryPaymentInput>;

// ---------------------------------------------------------------------------------------------
// API-COM-05 listMyOrders / getMyOrder (query)
// ---------------------------------------------------------------------------------------------

export const listMyOrdersInput = zListParams(
  ["createdAt"],
  z.object({ status: z.enum(ORDER_STATUSES).optional() }).strict(),
);
export type ListMyOrdersInput = z.infer<typeof listMyOrdersInput>;

export const getMyOrderInput = z.object({ orderNo: zPublicOrderNo }).strict();
export type GetMyOrderInput = z.infer<typeof getMyOrderInput>;

export interface OrderSummary {
  orderId: string;
  orderNo: string;
  type: OrderType;
  status: OrderStatus;
  total: Money;
  itemCount: number;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
}

export interface OrderPaymentView {
  paymentId: string;
  method: Payment["provider"];
  status: PaymentStatus;
  amountDue: Money;
  amountReceived: Money | null;
  instructions: PaymentInstructions | null;
  customerReference: string | null;
  customerSubmittedAt: string | null;
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  payments: OrderPaymentView[];
  invoice?: { invoiceId: string; invoiceNo: string };
  entitlements: { entitlementId: string; deliveryType: string; status: string }[];
  /** Sanitised delivery instructions rendered server-side (A-601). */
  instructionsHtml: string;
}

// ---------------------------------------------------------------------------------------------
// API-COM-06 listOrdersAdmin / getOrderAdmin (query)
// ---------------------------------------------------------------------------------------------

export const listOrdersAdminInput = zListParams(
  ["createdAt", "total", "status"],
  z
    .object({
      status: z.enum(ORDER_STATUSES).optional(),
      type: z.enum(ORDER_TYPES).optional(),
      userId: zUuid.optional(),
      productId: zUuid.optional(),
      ...zDateRange,
    })
    .strict(),
);
export type ListOrdersAdminInput = z.infer<typeof listOrdersAdminInput>;

export const getOrderAdminInput = z.object({ orderId: zUuid }).strict();
export type GetOrderAdminInput = z.infer<typeof getOrderAdminInput>;

export interface OrderAdminRow extends OrderSummary {
  customer: { userId: string | null; name: string; email: string };
  paymentStatus: PaymentStatus | null;
  shortfallMinor: number | null;
  customerCreditMinor: number | null;
  /** Present once `finance.postOrderPaid` ran. */
  allocation?: { distributableMinor: number; companyMinor: number; partnerCount: number };
  splitApprovalRequestId: string | null;
}

// ---------------------------------------------------------------------------------------------
// API-COM-07 createManualOrder (D-1107, A-502)
// ---------------------------------------------------------------------------------------------

export const zManualOrderCustomer = z.union([
  z.object({ userId: zUuid }).strict(),
  z
    .object({
      clientName: zTrimmed(1, 120),
      clientEmail: zEmail,
      clientCompany: zTrimmed(0, 120).optional(),
    })
    .strict(),
]);
export type ManualOrderCustomer = z.infer<typeof zManualOrderCustomer>;

export const zManualOrderProductLine = z.object({ offeringId: zUuid }).strict();
export const zManualOrderProjectLine = z
  .object({
    description: zTrimmed(1, 500),
    unitMinor: zPositiveMinor,
    quantity: z.number().int().min(1).max(1000).default(1),
    splitSnapshot: zSplitSnapshot,
  })
  .strict();
export const zManualOrderLine = z.union([zManualOrderProductLine, zManualOrderProjectLine]);
export type ManualOrderLine = z.infer<typeof zManualOrderLine>;

export function isProjectLine(
  line: ManualOrderLine,
): line is z.infer<typeof zManualOrderProjectLine> {
  return "splitSnapshot" in line;
}

/** Recorded up-front payment for a manual `product` order (runs API-PAY-03 in the same tx). */
export const zManualOrderPayment = z
  .object({
    method: zManualPaymentMethod,
    amountReceivedMinor: zMinor,
    reference: zTrimmed(1, 120),
    paidOn: zIsoDate,
  })
  .strict();

export const createManualOrderInput = z
  .object({
    type: z.enum(ORDER_TYPES),
    customer: zManualOrderCustomer,
    currency: zCurrency,
    items: z.array(zManualOrderLine).min(1).max(50),
    discountMinor: zMinor.optional(),
    taxEnabled: z.boolean(),
    billing: zBilling,
    notes: zTrimmed(0, 2000).optional(),
    payment: zManualOrderPayment.optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    input.items.forEach((item, i) => {
      const project = isProjectLine(item);
      if (input.type === "project" && !project) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i],
          message: "project orders take project lines (description + splitSnapshot)",
        });
      }
      if (input.type === "product" && project) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i],
          message: "product orders take offering lines (offeringId)",
        });
      }
    });
    if (input.type === "project" && input.payment !== undefined) {
      // STATE_INVALID at runtime once the split is applied; at parse time it is never valid.
      ctx.addIssue({
        code: "custom",
        path: ["payment"],
        message: "project orders are paid via confirmPayment after the split is applied",
      });
    }
  });
export type CreateManualOrderInput = z.infer<typeof createManualOrderInput>;

export interface CreateManualOrderResult {
  orderId: string;
  orderNo: string;
  /** `project_order.split` request for project orders. */
  approvalRequestId?: string;
  paymentId?: string;
  invoiceId?: string;
}

// ---------------------------------------------------------------------------------------------
// API-COM-14 applyProjectOrderSplit (internal) — approval payload for `project_order.split`
// ---------------------------------------------------------------------------------------------

export const projectOrderSplitPayload = z.object({ orderId: zUuid }).strict();
export type ProjectOrderSplitPayload = z.infer<typeof projectOrderSplitPayload>;

// ---------------------------------------------------------------------------------------------
// Internal transitions used by payments / cron / delivery
// ---------------------------------------------------------------------------------------------

/** Tax rule for API-COM-01/02/07 (BR-08, D-504, D-519, D-1501). */
export function taxRateBpsFor(input: {
  productTaxEnabled: boolean;
  gstin: string | null;
  settingsTaxRateBps: number;
}): number {
  return input.productTaxEnabled && input.gstin !== null && input.gstin !== ""
    ? input.settingsTaxRateBps
    : 0;
}

export interface ExpireOrdersResult {
  /** Orders moved `pending_payment → failed` (cron `orders.expire`, BR-10). */
  expiredOrderIds: string[];
}

/**
 * Fulfilment rule input (MASTER_SPEC §7 "Order fulfilled"): every entitlement `active` and every
 * service checklist complete. Evaluated by `OrdersService.evaluateFulfilled` after delivery events.
 */
export interface FulfilmentSnapshot {
  entitlements: { status: string }[];
  serviceChecklists: { complete: boolean }[];
}

export function isFulfilled(snapshot: FulfilmentSnapshot): boolean {
  return (
    snapshot.entitlements.length > 0 &&
    snapshot.entitlements.every((e) => e.status === "active") &&
    snapshot.serviceChecklists.every((c) => c.complete)
  );
}

export type { BillingSnapshot, Order, OrderItem, OrderStatus, OrderType, SplitSnapshot };
