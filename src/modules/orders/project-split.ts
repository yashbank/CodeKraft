/**
 * `project_order.split` approval handlers (API-COM-14, MASTER_SPEC §7 "Project order splits").
 * Apply stores `orders.split_approval_request_id` — the flag `payments.confirmPayment` and
 * `invoices.issueInvoice` check; reject cancels the order (it was never payable).
 */
import { and, eq } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { orders, payments } from "../../../drizzle/schema/commerce";
import type { OrdersModule } from "./service";
import type { ProjectOrderSplitPayload } from "./types";

export async function applyProjectOrderSplit(
  svc: OrdersModule,
  payload: ProjectOrderSplitPayload,
  approvalRequestId: string,
  tx: TxCtx,
): Promise<void> {
  const now = svc.deps.now ?? (() => new Date());
  const [order] = await tx.select().from(orders).where(eq(orders.id, payload.orderId)).for("update").limit(1);
  if (order === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
  if (order.type !== "project") throw new AppError(ErrorCode.STATE_INVALID, "Only project orders carry a split approval.");
  if (order.splitApprovalRequestId === approvalRequestId) return; // idempotent re-apply
  if (order.status !== "pending_payment") throw new AppError(ErrorCode.STATE_INVALID, "Order is no longer awaiting payment.");
  await tx
    .update(orders)
    .set({ splitApprovalRequestId: approvalRequestId, updatedAt: now() })
    .where(eq(orders.id, order.id));
}

export async function rejectProjectOrderSplit(
  svc: OrdersModule,
  payload: ProjectOrderSplitPayload,
  tx: TxCtx,
): Promise<void> {
  const now = svc.deps.now ?? (() => new Date());
  await tx
    .update(orders)
    .set({ status: "cancelled", cancelledAt: now(), updatedAt: now() })
    .where(and(eq(orders.id, payload.orderId), eq(orders.status, "pending_payment")));
  await tx
    .update(payments)
    .set({ status: "failed", failureReason: "split_rejected" })
    .where(and(eq(payments.orderId, payload.orderId), eq(payments.status, "initiated")));
}

/** True when the order's `split_approval_request_id` points at an `applied` request (BR-05). */
export async function isProjectSplitApplied(
  order: { type: string; splitApprovalRequestId: string | null },
  tx: TxCtx,
): Promise<boolean> {
  if (order.type !== "project") return true;
  if (order.splitApprovalRequestId === null) return false;
  const [req] = await tx
    .select({ status: approvalRequests.status })
    .from(approvalRequests)
    .where(eq(approvalRequests.id, order.splitApprovalRequestId))
    .limit(1);
  return req?.status === "applied";
}

export function assertProjectSplitApplied(
  order: { orderNo: string; type: string; splitApprovalRequestId: string | null },
  tx: TxCtx,
): Promise<void> {
  return isProjectSplitApplied(order, tx).then((ok) => {
    if (!ok) {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        `Project order ${order.orderNo} cannot be invoiced or paid until its split is approved.`,
      );
    }
  });
}
