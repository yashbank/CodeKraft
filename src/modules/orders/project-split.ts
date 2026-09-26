/**
 * Project order split approval handlers (API-COM-14, BR-05, MASTER_SPEC §7).
 *
 * Implements applyProjectOrderSplit and rejectProjectOrderSplit, registered with approvalsService.
 */
import { eq } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { orders } from "../../../drizzle/schema/commerce";
import { approvalsService } from "@/modules/approvals/service";
import type { ApplyContext } from "@/modules/approvals/contracts";
import { auditService } from "@/modules/audit/service";
import { AppError, ErrorCode } from "@/lib/errors";
import type { ProjectOrderSplitPayload } from "./types";

export async function applyProjectOrderSplit(
  payload: ProjectOrderSplitPayload,
  approvalRequestId: string,
  tx: TxCtx,
): Promise<void> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, payload.orderId))
    .limit(1);

  if (!order) {
    throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
  }

  await tx
    .update(orders)
    .set({
      splitApprovalRequestId: approvalRequestId,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, payload.orderId));

  await auditService.log(
    {
      kind: "system",
      name: "system",
      requestId: approvalRequestId,
    },
    "order.split_approved",
    { type: "order", id: order.id },
    order,
    { splitApprovalRequestId: approvalRequestId },
    tx,
  );
}

export async function rejectProjectOrderSplit(
  ctx: ApplyContext,
  payload: ProjectOrderSplitPayload,
  tx: TxCtx,
): Promise<void> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, payload.orderId))
    .limit(1);

  if (order && order.status === "pending_payment") {
    await tx
      .update(orders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, payload.orderId));

    await auditService.log(
      {
        kind: "system",
        name: "system",
        requestId: ctx.requestId,
      },
      "order.split_rejected",
      { type: "order", id: order.id },
      order,
      { status: "cancelled" },
      tx,
    );
  }
}

// Register handlers with approvalsService
approvalsService.registerApplyHandler("project_order.split", async (ctx, payload, tx) => {
  await applyProjectOrderSplit(payload, ctx.requestId, tx);
});

approvalsService.registerRejectHandler("project_order.split", async (ctx, payload, tx) => {
  await rejectProjectOrderSplit(ctx, payload, tx);
});
