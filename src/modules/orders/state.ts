/**
 * Order state machine and fulfilment evaluator (docs/03 §3.1, MASTER_SPEC §7 "Order fulfilled").
 */
import { and, eq, inArray } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { orderItems, orders } from "../../../drizzle/schema/commerce";
import { entitlements, serviceProgress } from "../../../drizzle/schema/delivery";
import { ORDER_STATUS_TRANSITIONS, type OrderStatus } from "./types";

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function assertCanTransitionOrder(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new AppError(
      ErrorCode.STATE_INVALID,
      `Cannot transition order from '${from}' to '${to}'`,
    );
  }
}

/**
 * Checks if all entitlements for the order are active, and if any service steps are completed.
 * When complete, sets order status to 'fulfilled' and records 'fulfilled_at'.
 */
export async function markFulfilledIfComplete(
  orderId: string,
  tx: TxCtx,
): Promise<{ fulfilled: boolean }> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status !== "paid") {
    return { fulfilled: false };
  }

  // 1. Check entitlements linked to this order's items
  const orderEntitlements = await tx
    .select({
      id: entitlements.id,
      status: entitlements.status,
    })
    .from(entitlements)
    .innerJoin(orderItems, eq(entitlements.orderItemId, orderItems.id))
    .where(eq(orderItems.orderId, orderId));

  if (orderEntitlements.length === 0) {
    return { fulfilled: false };
  }

  const allEntitlementsActive = orderEntitlements.every((e) => e.status === "active");
  if (!allEntitlementsActive) {
    return { fulfilled: false };
  }

  // 2. Check service progress for any service entitlements
  const entitlementIds = orderEntitlements.map((e) => e.id);
  const steps = await tx
    .select()
    .from(serviceProgress)
    .where(inArray(serviceProgress.entitlementId, entitlementIds));

  const allStepsCompleted = steps.every((s) => s.doneAt !== null);
  if (!allStepsCompleted) {
    return { fulfilled: false };
  }

  // Mark fulfilled
  const now = new Date();
  await tx
    .update(orders)
    .set({
      status: "fulfilled",
      fulfilledAt: now,
      updatedAt: now,
    })
    .where(eq(orders.id, orderId));

  return { fulfilled: true };
}
