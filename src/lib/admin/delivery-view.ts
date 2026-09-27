/**
 * View-model mapper: `modules/delivery` task rows -> the admin `DeliveryTasksScreen`'s row shape
 * (`components/admin/types` `DeliveryTaskRow`). Kept out of the page component per the phase
 * convention.
 *
 * Known gaps vs. a fully-populated screen -- see the phase report:
 *  - `hints` is always omitted: no per-task free-text hint is stored; the screen falls back to a
 *    generic kind-based hint (same fallback the original fixture-driven design used).
 *  - `orderNumber` reads "Manual grant" when the entitlement has no `orderItemId` (an admin-granted
 *    entitlement, D-1108) -- there genuinely is no order behind it.
 */
import type { DeliveryTaskRow as ModuleDeliveryTaskRow } from "@/modules/delivery/types";
import type { DeliveryTaskRow } from "@/components/admin/types";

export function mapDeliveryTaskRow(row: ModuleDeliveryTaskRow): DeliveryTaskRow {
  return {
    id: row.taskId,
    createdAt: row.createdAt,
    kind: row.kind,
    customer: {
      id: row.customer.id,
      name: row.customer.name ?? row.customer.email,
      email: row.customer.email,
    },
    product: row.product.name,
    offering: row.offeringName ?? "—",
    entitlementStatus: row.entitlementStatus as DeliveryTaskRow["entitlementStatus"],
    ...(row.assignedTo ? { assignedTo: row.assignedTo.name ?? "Unassigned admin" } : {}),
    ...(row.note ? { note: row.note } : {}),
    status: row.status,
    orderId: row.order?.id ?? "",
    orderNumber: row.order?.orderNo ?? "—",
  };
}
