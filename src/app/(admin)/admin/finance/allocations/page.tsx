import { AllocationsScreen } from "@/components/admin/finance/AllocationsScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import {
  allocationRowFiltersActive,
  filterAllocationOrders,
  filterAllocationRows,
  parseAllocationFilters,
  type SearchParams,
} from "@/lib/admin/finance-filters";
import { buildPartnerNameMaps, mapOrderAllocationToRows } from "@/lib/admin/finance-view";
import { getOrderAllocationQuery } from "@/modules/finance/queries";
import { getOrderAdminQuery, listOrdersAdminQuery } from "@/modules/orders/queries";
import { listPartnersQuery } from "@/modules/users/queries";
import type { AllocationRow } from "@/components/admin/types";

export const dynamic = "force-dynamic";

/** Statuses for which `finance.getOrderAllocation` has a row to return (posted at payment time). */
const ALLOCATED_STATUSES = new Set(["paid", "fulfilled", "refunded", "partially_refunded"]);
/** How many recent allocated orders to pull onto this page (one `getOrderAllocation` + one
 * `getOrderAdmin` call each -- there is no cross-order "list allocations" query, see report). */
const ORDER_LIMIT = 15;

export default async function AdminAllocationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseAllocationFilters(await searchParams);
  const ctx = await getAdminRequestContext();

  const [ordersResult, partnersResult] = await Promise.all([
    listOrdersAdminQuery({ limit: 100, sort: "createdAt:desc" }, ctx),
    listPartnersQuery({ limit: 100 }, ctx).catch(() => ({ ok: false as const })),
  ]);

  const { byPartnerId: partnerNames } = buildPartnerNameMaps(
    "data" in partnersResult && partnersResult.ok ? partnersResult.data.items : [],
  );

  const orders = ordersResult.ok
    ? filterAllocationOrders(
        ordersResult.data.items.filter((o) => ALLOCATED_STATUSES.has(o.status)),
        filters,
      )
        // Product / partner / version are row-level, so scan more orders before cutting to the
        // page size or a match older than the 15 newest orders would silently vanish.
        .slice(0, allocationRowFiltersActive(filters) ? 100 : ORDER_LIMIT)
    : [];

  const perOrder = await Promise.all(
    orders.map(async (order) => {
      const [allocationResult, detailResult] = await Promise.all([
        getOrderAllocationQuery({ orderId: order.orderId }, ctx),
        getOrderAdminQuery({ orderId: order.orderId }, ctx),
      ]);
      if (!allocationResult.ok) return [] as AllocationRow[];
      const productNames = new Map<string, string>();
      if (detailResult.ok) {
        for (const [itemId, meta] of Object.entries(detailResult.data.itemMeta)) {
          if (meta.productName) productNames.set(itemId, meta.productName);
        }
      }
      return mapOrderAllocationToRows(
        { order, allocation: allocationResult.data, productNames },
        partnerNames,
      );
    }),
  );

  const rows = filterAllocationRows(perOrder.flat(), filters).sort((a, b) =>
    a.at < b.at ? 1 : -1,
  );

  return (
    <AllocationsScreen
      rows={rows}
      products={[...new Set(perOrder.flat().map((r) => r.product))].sort()}
      partners={[...new Set(partnerNames.values())]} // display names are not unique; they key the columns
      orderHref="/admin/orders"
      ledgerHref="/admin/finance/ledger"
      productHref="/admin/products"
      isSuperAdmin={ctx.roles.includes("super_admin")}
      ownPartnerName={ctx.partnerId ? (partnerNames.get(ctx.partnerId) ?? null) : null}
    />
  );
}
