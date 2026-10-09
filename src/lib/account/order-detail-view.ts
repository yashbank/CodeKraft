/**
 * View-model mapper for the customer order status screen (SCR-ACC-11) -- `modules/orders`'s
 * `OrderDetail` (the `getMyOrder` / `getOrderAdmin` shared shape) -> `components/account/types.ts`'s
 * `OrderView`. Kept out of the page and out of the screen component, per the `purchases-view.ts` /
 * admin `orders-view.ts` convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `purchaseModelLine` can only distinguish "Custom quote" (via `detail.quote`) from "One-time
 *    purchase" -- `OrderDetail` carries no `offerings.purchase_model`, so a subscription order
 *    renders as "One-time purchase" too. Fixing this needs a join the service doesn't do yet.
 *  - `deliveryType` comes from the first line's `itemMeta` and falls back to `"custom"` when
 *    unset, same as the admin mapper (`getOrderAdmin` has the identical gap).
 *  - `enabledMethods` is narrowed to the order's *actual* payment method (`[latestPayment.method]`)
 *    rather than the offering's full `offering_payment_methods` row, which `OrderDetail` doesn't
 *    carry -- showing a "switch method" option we can't confirm is actually enabled would be worse
 *    than under-showing it. Falls back to both manual methods only when no payment row exists yet.
 *  - `refund.creditNoteNumber` falls back to `"Pending"` when a refund exists but no credit note
 *    has been issued yet (rather than an empty string).
 */
import type {
  BillingDetails,
  OrderLine,
  OrderView,
  PaymentInstructions as AccountPaymentInstructions,
  PaymentProvider,
} from "@/components/account/types";
import type { Currency, Money } from "@/lib/money";
import { money } from "@/lib/money";
import type { OrderDetail, OrderPaymentView } from "@/modules/orders/types";
import type { PaymentInstructions as ProviderPaymentInstructions } from "@/modules/payments/provider";
import { toManualPaymentProviders } from "./checkout-view";

function taxLabel(taxRateBps: number, kind: string | undefined): string {
  if (taxRateBps <= 0) return "No tax";
  if (kind === "igst") return `IGST (${(taxRateBps / 100).toFixed(0)}%)`;
  if (kind === "export") return "Export (zero-rated)";
  return `GST (${(taxRateBps / 100).toFixed(0)}%)`;
}

/**
 * `OrderPaymentView.instructions` from `getMyOrder` carries the API-view shape
 * (`modules/payments/provider.ts`'s `UpiInstructions | BankInstructions | GatewayInstructions`,
 * `accountNo` not `accountNumber` -- see `manual.ts`'s `createIntent`), not the differently-shaped
 * `components/account/types.ts` `PaymentInstructions` the checkout/order-status UI renders.
 */
function mapPaymentInstructions(
  instructions: ProviderPaymentInstructions | null,
): AccountPaymentInstructions {
  if (!instructions) return {};
  if (instructions.method === "manual_upi") {
    return { upi: { vpa: instructions.vpa, payeeName: instructions.payeeName } };
  }
  if (instructions.method === "manual_bank") {
    return {
      bank: {
        accountName: instructions.accountName,
        accountNumber: instructions.accountNo,
        ifsc: instructions.ifsc,
        bankName: instructions.bankName,
        swift: instructions.swift,
      },
    };
  }
  // Gateway methods have no live provider in this release (D-501) -- nothing to render.
  return {};
}

function mapPostPurchaseInstructions(instructionsHtml: string): string[] {
  const text = instructionsHtml
    .replace(/<[^>]+>/g, " ")
    .split(/\s{2,}|\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return text;
}

export function mapOrderDetailToOrderView(detail: OrderDetail): OrderView {
  const { order, items, itemMeta, payments, refunds, coupon, quote } = detail;
  const currency = order.currency as Currency;
  const latestPayment: OrderPaymentView | undefined = payments[0];
  const latestRefund = refunds[0];
  const firstMeta = items[0] ? itemMeta[items[0].id] : undefined;

  const lines: OrderLine[] = items.map((it) => ({
    name: it.description,
    unit: money(it.unitMinor, currency),
    quantity: it.quantity,
    discount: it.discountMinor > 0 ? money(it.discountMinor, currency) : undefined,
    taxLabel: taxLabel(order.taxRateBps, order.taxSnapshot?.kind),
    total: money(it.totalMinor, currency),
  }));

  const enabledMethods: PaymentProvider[] = latestPayment
    ? toManualPaymentProviders([latestPayment.method])
    : ["manual_upi", "manual_bank"];

  const paymentMethod: PaymentProvider = enabledMethods[0] ?? "manual_upi";

  const billing: BillingDetails = {
    name: order.billingSnapshot?.name ?? "",
    company: order.billingSnapshot?.company ?? undefined,
    line1: order.billingSnapshot?.address ?? undefined,
    country: order.billingSnapshot?.country ?? "IN",
    gstNumber: order.billingSnapshot?.gst_number ?? undefined,
  };

  const refund: OrderView["refund"] = latestRefund
    ? {
        amount: money(latestRefund.amountMinor, latestRefund.currency),
        creditNoteNumber: latestRefund.creditNoteNo ?? "Pending",
        revokedAt: order.status === "refunded" ? order.refundedAt?.toISOString() : undefined,
      }
    : undefined;

  const payment: OrderView["payment"] = latestPayment
    ? {
        status: latestPayment.status,
        reference: latestPayment.customerReference ?? undefined,
        paidOn: latestPayment.customerSubmittedAt ?? undefined,
        confirmedAt: latestPayment.confirmedAt ?? undefined,
        received: latestPayment.amountReceived ?? undefined,
        shortfall: latestPayment.bankShortfall ?? undefined,
        failureReason: latestPayment.failureReason ?? undefined,
      }
    : undefined;

  const failedReason: OrderView["failedReason"] =
    order.status === "failed"
      ? "expired"
      : order.status === "cancelled"
        ? "cancelled_by_customer"
        : undefined;

  const subtotal: Money = money(order.subtotalMinor, currency);
  const tax: Money | null = order.taxMinor > 0 ? money(order.taxMinor, currency) : null;
  const total: Money = money(order.totalMinor, currency);

  return {
    id: order.id,
    number: order.orderNo,
    placedAt: order.createdAt.toISOString(),
    status: order.status,
    expiresAt: order.expiresAt ? order.expiresAt.toISOString() : undefined,
    productName: firstMeta?.productName ?? items[0]?.description ?? "Order",
    offeringName: items[0]?.description ?? "Order",
    purchaseModelLine: quote ? "Custom quote" : "One-time purchase",
    deliveryType: (firstMeta?.deliveryType ?? "custom") as OrderView["deliveryType"],
    lines,
    subtotal,
    discount:
      order.discountMinor > 0
        ? { code: coupon?.code ?? "", amount: money(order.discountMinor, currency) }
        : undefined,
    tax,
    total,
    billing,
    paymentMethod,
    enabledMethods,
    instructionsFor: mapPaymentInstructions(latestPayment?.instructions ?? null),
    payment,
    refund,
    refundable:
      order.status === "paid" ||
      order.status === "fulfilled" ||
      order.status === "partially_refunded",
    entitlementId: detail.entitlements[0]?.entitlementId,
    invoiceNumber: detail.invoice?.invoiceNo,
    postPurchaseInstructions: mapPostPurchaseInstructions(detail.instructionsHtml),
    failedReason,
  };
}
