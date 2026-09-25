/** Order state machine guard (docs/03 §3.1, MASTER_SPEC §7 "Order failed" / "Order cancelled"). */
import { AppError, ErrorCode } from "@/lib/errors";
import { ORDER_STATUS_TRANSITIONS, type OrderStatus } from "./types";

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/** Throws `STATE_INVALID` with a client-safe message when `from → to` is not in the machine. */
export function assertTransition(from: OrderStatus, to: OrderStatus, orderNo?: string): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      ErrorCode.STATE_INVALID,
      `Order${orderNo === undefined ? "" : ` ${orderNo}`} cannot go from ${from} to ${to}.`,
    );
  }
}

/** `expires_at` in the past for a still-pending order (BR-10). */
export function isExpired(order: { status: OrderStatus; expiresAt: Date | null }, now: Date): boolean {
  return order.status === "pending_payment" && order.expiresAt !== null && order.expiresAt.getTime() < now.getTime();
}
