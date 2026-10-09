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
import type {
  EntitlementDetail,
  EntitlementSummary,
  OrderSummaryView,
  ServiceStep,
} from "@/components/account/types";
import type { EntitlementView } from "@/modules/entitlements/types";
import type { OrderSummary } from "@/modules/orders/types";

/** `2.4 MB` / `850 KB` -- no byte-formatting helper exists elsewhere in the codebase to reuse. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

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

/**
 * View model for the entitlement detail screen (SCR-ACC-03) -- builds on `mapEntitlementSummary`
 * rather than duplicating its field mapping, then adds the delivery-type-specific detail fields
 * `EntitlementDetail` needs on top of `EntitlementSummary`.
 *
 * Known gaps, flagged rather than fabricated (see also the file header):
 *  - `licenseKey.full` always mirrors `licenseKey.masked` -- `licenseKeyMasked` is masked by
 *    design (BR-15-adjacent security measure). The real key is only ever returned by the
 *    dedicated, rate-limited, audited `revealLicenseKey` action (API-DEL-03,
 *    `modules/entitlements/service.ts`), which requires its own "Reveal" round trip (and the
 *    product copy promises a password re-prompt after 60 min) -- out of scope for this read-only
 *    detail page. `EntitlementDetail.licenseKey.full` is non-optional when the object is present,
 *    so the alternative would be omitting the whole `licenseKey` object and hiding the masked key
 *    too, which is strictly worse for the customer; mirroring the masked value keeps the page
 *    honest (never shows a real secret) without hiding the one thing we *can* show.
 *  - `hosted` is always left undefined -- `provisioning.notes` (`ProvisioningNotesSchema`) is
 *    structured (`loginUrl?`, `username?`, `message?`), not free text, but it has no equivalent of
 *    `hosted.credentialsSentAt` (required by `EntitlementDetail.hosted`), and nothing elsewhere in
 *    `EntitlementView` carries that timestamp. Rather than fabricate a "sent on" date, the hosted
 *    panel renders its "being set up" state instead.
 *  - `changelog` is always `[]` -- `EntitlementView.versions` is always `[]` from
 *    `buildCustomerView` (release catalog isn't wired into the customer view yet); mapped
 *    faithfully so it fills in automatically once that's done.
 *  - `instructions` falls back to `[]` -- `instructionsHtml` is always `null` from the service
 *    today (same gap); when it is eventually populated this does a minimal tag-strip rather than
 *    a real HTML->paragraphs split, since there's nothing to test that against yet.
 */
export function mapEntitlementDetail(e: EntitlementView): EntitlementDetail {
  const steps: ServiceStep[] = (e.serviceProgress ?? []).map((s) => ({
    id: s.key,
    title: s.title,
    description: s.description ?? undefined,
    state: s.doneAt !== null ? "done" : "open",
    doneAt: s.doneAt ?? undefined,
  }));

  return {
    ...mapEntitlementSummary(e),
    files: e.downloads?.files.map((f) => ({
      id: f.mediaId,
      name: f.name,
      version: f.version,
      sizeLabel: formatSize(f.sizeBytes),
      releasedAt: f.releasedAt,
    })),
    changelog: e.versions.flatMap((v) =>
      v.changelog === null
        ? []
        : [
            {
              version: v.version,
              date: v.releasedAt,
              notes: v.changelog.split("\n").filter(Boolean),
            },
          ],
    ),
    // See file header: `full` intentionally mirrors `masked` -- the real key needs the dedicated
    // `revealLicenseKey` action, not this read-only query.
    licenseKey: e.licenseKeyMasked
      ? { masked: e.licenseKeyMasked, full: e.licenseKeyMasked }
      : undefined,
    hosted: undefined,
    steps: e.deliveryType === "service" ? steps : undefined,
    attachments: e.custom?.attachments.map((a) => ({
      name: a.name,
      sizeLabel: formatSize(a.sizeBytes),
    })),
    instructions: e.instructionsHtml
      ? e.instructionsHtml
          .replace(/<[^>]+>/g, " ")
          .split(/\s{2,}|\n+/)
          .map((p) => p.trim())
          .filter(Boolean)
      : [],
  };
}

export function mapOrderSummaryView(o: OrderSummary): OrderSummaryView {
  return {
    // The customer-facing identifier (`CK-ORD-000001`), not the internal uuid: it's what
    // `getMyOrder` (API-COM-05) looks orders up by, so the Purchases list's
    // `${links.order}/${o.id}` href lands on a route that can actually resolve it.
    id: o.orderNo,
    number: o.orderNo,
    placedAt: o.createdAt,
    status: o.status,
    productName: o.itemsSummary,
    offeringName: o.itemsSummary,
    total: o.total,
  };
}
