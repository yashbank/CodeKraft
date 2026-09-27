/**
 * View-model mapper for the admin Entitlements screen (SCR-ADM-12, entitlements tab only) —
 * `modules/entitlements`'s `EntitlementAdminRow` -> `components/admin/types.ts`'s
 * `EntitlementRow`. Kept out of the page and out of the screen component, per the
 * `finance-view.ts` / `customers-view.ts` convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `EntitlementRow.subscription` is always `undefined` — `EntitlementAdminRow` carries no
 *    subscription interval/period/status; the `subscriptions` module is a separate, unwired
 *    module and joining it here would be new backend work outside P6's declared scope.
 *  - `EntitlementRow.orderId` is a required field the component only ever uses to build an
 *    `orderHref` the page already passes in as a flat string (`/admin/orders`, not a per-row
 *    link) — `EntitlementAdminRow` only has `orderNo`, so this is set to `orderNo` as well; it is
 *    unused by the component beyond that.
 *  - The **delivery task queue** (the screen's other tab, "Delivery tasks") is a different
 *    module (`modules/delivery`, owned by P5 per the master plan ownership map, not P6) whose
 *    query/action wrappers are still the P2.8 stubs; wiring it would mean building out another
 *    phase's module from scratch, which is out of this pass's scope. The page passes `tasks={[]}`
 *    and that tab renders its existing "No open delivery tasks" empty state honestly, rather than
 *    faking task rows.
 */
import type { EntitlementAdminRow } from "@/modules/entitlements/types";
import type { EntitlementRow } from "@/components/admin/types";

export function mapEntitlementRow(e: EntitlementAdminRow): EntitlementRow {
  return {
    id: e.entitlementId,
    customer: { id: e.user.id, name: e.user.name ?? e.user.email, email: e.user.email },
    product: e.product.name,
    offering: e.offering.name,
    type: e.deliveryType,
    status: e.status,
    accessEnds: e.accessEndsAt ?? undefined,
    subscription: undefined,
    downloadsUsed: e.downloads?.used,
    downloadCap: e.downloads?.cap ?? undefined,
    keyIssued: e.deliveryType === "license" ? e.licenseKeyIssued : undefined,
    provisioning: e.provisioningState,
    orderNumber: e.orderNo ?? "—",
    orderId: e.orderNo ?? "",
    grantedManually: e.grantedManuallyBy !== null,
  };
}
