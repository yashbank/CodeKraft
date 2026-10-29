/** Pure logic for the post-payment "Confirming your payment" screen (R9-06). No DB, client-safe. */

export type ConfirmStage = "pending" | "paid" | "failed";

export interface ConfirmStatus {
  stage: ConfirmStage;
  orderNo: string;
  deliveryType: string | null;
  entitlementId: string | null;
}

const PAID_ORDER = ["paid", "fulfilled", "partially_refunded", "refunded"];
const FAILED_ORDER = ["failed", "cancelled"];

export function confirmStage(orderStatus: string, paymentStatus?: string | null): ConfirmStage {
  if (PAID_ORDER.includes(orderStatus) || paymentStatus === "confirmed") return "paid";
  if (FAILED_ORDER.includes(orderStatus) || paymentStatus === "failed") return "failed";
  return "pending";
}

/** Minimal slice of `OrderDetail` the screen needs. */
export function toConfirmStatus(d: {
  order: { orderNo: string; status: string };
  payments: { status: string }[];
  entitlements: { entitlementId: string; deliveryType: string }[];
}): ConfirmStatus {
  const ent = d.entitlements[0];
  return {
    stage: confirmStage(d.order.status, d.payments[0]?.status),
    orderNo: d.order.orderNo,
    deliveryType: ent?.deliveryType ?? null,
    entitlementId: ent?.entitlementId ?? null,
  };
}

/** Next step once paid, by product type. Falls back to the purchases list until an entitlement exists. */
export function nextStep(s: Pick<ConfirmStatus, "deliveryType" | "entitlementId">) {
  const href = s.entitlementId ? `/account/purchases/${s.entitlementId}` : "/account/purchases";
  if (s.deliveryType === "download") return { label: "Download", href };
  if (s.deliveryType === "license") return { label: "Reveal licence key", href };
  return { label: "View delivery steps", href };
}

/**
 * What /checkout/[offeringId] does when the checkout preview fails. If the customer already has a
 * submitted/paid order for this offering (reload after paying, gateway return, double click) they
 * go to the confirming screen -- never to a 404 or the "Back to product" dead end.
 */
export function checkoutFallback(
  code: string,
  recentOrderNo: string | null,
): { redirect: string } | "notFound" | "duplicate" | "unavailable" {
  if (recentOrderNo) return { redirect: `/checkout/confirming/${recentOrderNo}` };
  if (code === "NOT_FOUND") return "notFound";
  return code === "DUPLICATE_PURCHASE" ? "duplicate" : "unavailable";
}
