/**
 * Order expiry service (docs/06 §3.3, BR-10, D-412, MASTER_SPEC §7 "Order failed").
 */
import { and, eq, inArray, lt } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { withTx } from "@/lib/db";
import { orders, payments } from "../../../drizzle/schema/commerce";
import { emailOutbox, notifications } from "../../../drizzle/schema/notifications";
import type { ExpireOrdersResult } from "./types";

export async function expirePendingOrders(now: Date = new Date(), outerTx?: TxCtx): Promise<ExpireOrdersResult> {
  const runner = async (tx: TxCtx): Promise<ExpireOrdersResult> => {
    // 1. Find all pending_payment orders whose expires_at < now
    const expiredOrders = await tx
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        userId: orders.userId,
        billingSnapshot: orders.billingSnapshot,
      })
      .from(orders)
      .where(and(eq(orders.status, "pending_payment"), lt(orders.expiresAt, now)));

    if (expiredOrders.length === 0) {
      return { expiredOrderIds: [] };
    }

    const expiredOrderIds = expiredOrders.map((o) => o.id);

    // 2. Mark orders failed with status = 'failed' (never 'cancelled' per MASTER_SPEC §7)
    await tx
      .update(orders)
      .set({
        status: "failed",
        updatedAt: now,
      })
      .where(inArray(orders.id, expiredOrderIds));

    // 3. Mark open payments (initiated or submitted) failed with failure_reason = 'expired'
    await tx
      .update(payments)
      .set({
        status: "failed",
        failureReason: "expired",
      })
      .where(
        and(
          inArray(payments.orderId, expiredOrderIds),
          inArray(payments.status, ["initiated", "submitted"]),
        ),
      );

    // 4. Send customer notification and email outbox row per order
    for (const order of expiredOrders) {
      // In-app notification
      if (order.userId) {
        await tx.insert(notifications).values({
          userId: order.userId,
          type: "order.expired",
          title: "Order expired",
          body: `Order ${order.orderNo} has expired without payment.`,
          link: `/account/orders`,
          payload: { orderId: order.id, orderNo: order.orderNo },
        });
      }

      // Transactional email
      if (order.billingSnapshot?.email) {
        await tx.insert(emailOutbox).values({
          toEmail: order.billingSnapshot.email,
          template: "order-expired",
          payload: {
            orderId: order.id,
            orderNo: order.orderNo,
            name: order.billingSnapshot.name,
          },
          priority: 5,
          status: "queued",
        });
      }
    }

    return { expiredOrderIds };
  };

  if (outerTx) {
    return await runner(outerTx);
  }
  return await withTx(runner);
}
