import { ManualOrderForm } from "@/components/admin/commerce/ManualOrderForm";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapCustomerOptions } from "@/lib/admin/queries-view";
import { listCustomersQuery, listPartnersQuery } from "@/modules/users/queries";
import { listPublishedProductOfferingOptions } from "@/modules/offerings/queries";
import { settingsService } from "@/modules/settings/service";
import type { CustomerOption, OfferingOption } from "@/components/admin/types";

export const dynamic = "force-dynamic";

/**
 * Real "+ New manual order" route. Until this page existed, `OrdersList`'s "New manual order"
 * button linked to `/admin/orders/new`, which has no route of its own — Next.js matched the
 * sibling `[id]` dynamic route instead, treated "new" as an order id, and rendered "Order not
 * found". The backend (`createManualOrderAction` → `ordersService.createManualOrder`,
 * `src/modules/orders/manual.ts`) was already fully implemented; `ManualOrderForm` itself was
 * only ever mounted from a `/dev/screens` visual-preview page and its submit button just showed a
 * fake `toast.success(...)` with no real mutation call. This page supplies the real data the form
 * needs; `ManualOrderForm`'s submit handler now calls the real `createManualOrder` server action
 * (`@/modules/orders/admin-mutations`).
 */
export default async function AdminNewOrderPage() {
  const ctx = await getAdminRequestContext();

  const customersRes = await listCustomersQuery({ limit: 100 }, ctx);
  const customers: CustomerOption[] = customersRes.ok
    ? mapCustomerOptions(customersRes.data.items.map((c) => c.user))
    : [];

  // `finance.ledger.read_all` gates partner names — an admin without it still gets the page,
  // just with an empty partner list (only cosmetic for product orders; project-order splits
  // need partners and will show "no partners" if this is empty). Same graceful-degradation
  // pattern as `orders/[id]/page.tsx`.
  let partners: Array<{ id: string; name: string }> = [];
  try {
    const partnersRes = await listPartnersQuery({ limit: 100 }, ctx);
    if (partnersRes.ok) {
      partners = partnersRes.data.items.map((p) => ({ id: p.id, name: p.displayName }));
    }
  } catch {
    // leave partners empty
  }

  let gstinConfigured = false;
  let taxRateBps = 0;
  try {
    const settingsRes = await settingsService.getSettings(ctx);
    gstinConfigured = Boolean(settingsRes.settings.gstin?.trim());
    taxRateBps = settingsRes.settings.taxRateBps;
  } catch {
    // leave tax defaults
  }

  let offerings: OfferingOption[] = [];
  try {
    offerings = await listPublishedProductOfferingOptions(ctx);
  } catch {
    // leave offerings empty — the form shows "no offerings" rather than crashing the page
  }

  return (
    <ManualOrderForm
      customers={customers}
      offerings={offerings}
      partners={partners}
      approvers={["Priya Nair", "Arjun Patel"]}
      gstinConfigured={gstinConfigured}
      taxRateBps={taxRateBps}
      isSuperAdmin={ctx.roles.includes("super_admin")}
      initialType="product"
    />
  );
}
