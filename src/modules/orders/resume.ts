import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { storedInstructions } from "@/modules/payments/provider";
import { withLiveManualDetails } from "@/modules/payments/availability";
import { settingsService } from "@/modules/settings/service";
import { orderItems, orders, payments } from "../../../drizzle/schema/commerce";
import type { CreateOrderResult, ManualPaymentMethod } from "./types";

/**
 * Read-only counterpart of `createOrder`'s idempotency branch (docs/06 §1.5): returns the
 * customer's unexpired `pending_payment` order for this offering with its open payment
 * instructions, so a reload of `/checkout/[offeringId]` resumes the payment panel instead of
 * showing the place-order form again. `null` when there is nothing to resume.
 */
export async function findPendingCheckoutOrder(
  userId: string,
  offeringId: string,
): Promise<CreateOrderResult | null> {
  const [order] = await db
    .select({ id: orders.id, orderNo: orders.orderNo, expiresAt: orders.expiresAt })
    .from(orders)
    .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.offeringId, offeringId),
        eq(orders.status, "pending_payment"),
        gt(orders.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (!order?.expiresAt) return null;

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.orderId, order.id), inArray(payments.status, ["initiated", "submitted"])),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);
  const instructions = withLiveManualDetails(
    storedInstructions(payment?.instructions),
    await settingsService.load(),
  );
  if (!payment || !instructions) return null;

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    payment: {
      paymentId: payment.id,
      method: payment.provider as ManualPaymentMethod,
      instructions,
    },
    expiresAt: order.expiresAt.toISOString(),
  };
}

/**
 * Order number of this customer's latest order for the offering that already has a submitted or
 * confirmed payment (last 3 days). Used so a reload / gateway return after paying lands on the
 * "Confirming your payment" screen instead of a 404 or "can't be purchased" dead end.
 */
export async function findRecentPaidOrderNo(
  userId: string,
  offeringId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ orderNo: orders.orderNo })
    .from(orders)
    .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.offeringId, offeringId),
        inArray(payments.status, ["submitted", "confirmed"]),
        gt(orders.createdAt, new Date(Date.now() - 3 * 86_400_000)),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return row?.orderNo ?? null;
}
