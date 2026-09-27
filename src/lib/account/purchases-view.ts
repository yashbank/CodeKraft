/**
 * View-model mappers for the customer Purchases screen (SCR-ACC-02) --
 * `modules/entitlements`'s `EntitlementView` -> `components/account/types.ts`'s
 * `EntitlementSummary`, and `modules/orders`'s `OrderSummary` -> `OrderSummaryView`. Kept out of
 * the page and out of the screen component, per the admin `orders-view.ts` / `entitlements-view.ts`
 * convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `EntitlementSummary.subscription` is always left unset -- `SubscriptionView` (the entitlement
 *    service's per-entitlement subscription projection) carries no price, so there is nothing
 *    non-fabricated to put in `SubscriptionInfo.nextDue`. The base entitlement still renders.
 *  - `OrderSummaryView.payment` is always left unset -- `listMyOrders` returns an order-level
 *    summary only (no joined payment row), so the "Submit reference" / "Retry payment" wording in
 *    `orderAction()` can't be distinguished from a plain "Pay now" for a `pending_payment` order.
 */
import { formatDate } from "@/components/account/format";
import type { EntitlementSummary, OrderSummaryView } from "@/components/account/types";
import type { EntitlementView } from "@/modules/entitlements/types";
import type { OrderSummary } from "@/modules/orders/types";

function accessLabel(e: EntitlementView): string {
  if (e.subscription) {
    return `Renews ${formatDate(e.subscription.periodEnd)} · ${e.subscription.interval}`;
  }
  return e.access.endsAt ? `Until ${formatDate(e.access.endsAt)}` : "Lifetime";
}

function secondaryLine(e: EntitlementView): string | undefined {
  if (e.downloads) {
    return e.downloads.cap === null
      ? `${e.downloads.used} downloads used`
      : `${e.downloads.used} of ${e.downloads.cap} downloads left`;
  }
  if (e.licenseKeyMasked !== undefined) {
    return e.licenseKeyMasked ? "Key available" : "Key not yet issued";
  }
  if (e.provisioning) {
    return e.provisioning.state === "done" ? "Provisioned" : "Provisioning in progress";
  }
  if (e.serviceProgress && e.serviceProgress.length > 0) {
    const done = e.serviceProgress.filter((s) => s.doneAt !== null).length;
    return `${done} of ${e.serviceProgress.length} steps done`;
  }
  return undefined;
}

export function mapEntitlementSummary(e: EntitlementView): EntitlementSummary {
  return {
    id: e.entitlementId,
    productName: e.product.name,
    productHref: e.product.published ? `/products/${e.product.slug}` : undefined,
    offeringName: e.offering.name,
    deliveryType: e.deliveryType,
    status: e.status,
    provisioningState: e.provisioning?.state ?? "n/a",
    accessLabel: accessLabel(e),
    secondaryLine: secondaryLine(e),
    downloadsUsed: e.downloads?.used,
    downloadsCap: e.downloads?.cap ?? undefined,
    keyIssued: e.licenseKeyMasked ? true : e.licenseKeyMasked === null ? false : undefined,
    purchasedAt: e.grantedAt,
    accessEndsAt: e.access.endsAt ?? undefined,
    orderNumber: e.orderNo ?? "Manual grant",
    invoiceNumber: e.invoiceNo ?? undefined,
    updatePolicy: e.updatePolicy,
    versionOwned: e.versions[e.versions.length - 1]?.version,
    stepsDone: e.serviceProgress?.filter((s) => s.doneAt !== null).length,
    stepsTotal: e.serviceProgress?.length,
  };
}

export function mapOrderSummaryView(o: OrderSummary): OrderSummaryView {
  return {
    id: o.orderId,
    number: o.orderNo,
    placedAt: o.createdAt,
    status: o.status,
    productName: o.itemsSummary,
    offeringName: o.itemsSummary,
    total: o.total,
  };
}
