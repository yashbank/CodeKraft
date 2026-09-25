/**
 * Order fulfilment — MASTER_SPEC §7 "Order fulfilled", docs/06 §5.1 step 7, PHASE-05 P5.2.
 *
 * An order is `fulfilled` when every product line has an entitlement whose handler reports
 * `isFulfilled` (`download`/`custom`: active [+ marked]; `license`: key set; `saas`/`hosted`:
 * provisioning done; `service`: every checklist step done). Project lines (no offering) are
 * ignored; an order with no product lines never auto-fulfils here.
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { orderItems, orders } from "../../../drizzle/schema/commerce";
import {
  type Entitlement,
  type ServiceProgress,
  entitlements,
  serviceProgress,
} from "../../../drizzle/schema/delivery";
import type { DeliveryHandlerRegistry } from "./handler";

export interface FulfilmentItem {
  entitlement: Entitlement;
  serviceProgress: ServiceProgress[];
}

/** Pure: every item's handler must report fulfilled; `missing` = product lines without an entitlement. */
export function isOrderFulfilled(
  items: readonly FulfilmentItem[],
  missing: number,
  registry: DeliveryHandlerRegistry,
): boolean {
  if (missing > 0 || items.length === 0) return false;
  return items.every((item) =>
    registry.get(item.entitlement.deliveryType).isFulfilled(item.entitlement, item.serviceProgress),
  );
}

/**
 * Re-evaluate one order inside `tx`; sets `orders.status='fulfilled', fulfilled_at` (guarded by
 * `status='paid'`) and returns `true` only when the order transitioned in this call.
 */
export async function evaluateOrderFulfilment(
  orderId: string,
  tx: TxCtx,
  registry: DeliveryHandlerRegistry,
  now: Date = new Date(),
): Promise<boolean> {
  const [order] = await tx
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (order === undefined || order.status !== "paid") return false;

  const items = await tx
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), isNotNull(orderItems.offeringId)));
  if (items.length === 0) return false;

  const rows = await tx
    .select()
    .from(entitlements)
    .where(
      inArray(
        entitlements.orderItemId,
        items.map((i) => i.id),
      ),
    );
  const missing = items.length - rows.length;
  const progress =
    rows.length === 0
      ? []
      : await tx
          .select()
          .from(serviceProgress)
          .where(
            inArray(
              serviceProgress.entitlementId,
              rows.map((r) => r.id),
            ),
          );
  const fulfilled = isOrderFulfilled(
    rows.map((entitlement) => ({
      entitlement,
      serviceProgress: progress.filter((p) => p.entitlementId === entitlement.id),
    })),
    missing,
    registry,
  );
  if (!fulfilled) return false;

  const updated = await tx
    .update(orders)
    .set({ status: "fulfilled", fulfilledAt: now, updatedAt: sql`now()` })
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid")))
    .returning({ id: orders.id });
  return updated.length > 0;
}
