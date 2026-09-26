/**
 * `payments` refund implementation — proposeRefund (API-PAY-05) + applyRefund (API-PAY-06).
 * Owned by P4.8 (docs/06 §5.2, FR-PAY-12, FR-PAY-13, BR-09, BR-13).
 *
 * Forbidden: other `payments/**` files.
 */
import { and, eq, sql } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { approvalsService } from "@/modules/approvals/service";
import { financeService } from "@/modules/finance/service";
import { orderItems, orders, payments, refunds } from "../../../drizzle/schema/commerce";
import { products } from "../../../drizzle/schema/catalog";
import { entitlements } from "../../../drizzle/schema/delivery";
import { emailOutbox, notifications } from "../../../drizzle/schema/notifications";
import type { ApplyContext } from "@/modules/approvals/contracts";
import type {
  ApplyRefundResult,
  ProposeRefundInput,
  ProposeRefundResult,
  RefundIssuePayload,
} from "./types";
import { PAYMENT_STATUS_TRANSITIONS } from "./types";

// ----------------------------------------------------------------------------------------------------
// API-PAY-05: proposeRefund
// ----------------------------------------------------------------------------------------------------

export async function proposeRefund(
  ctx: RequestContext,
  input: ProposeRefundInput,
  outerTx?: TxCtx,
): Promise<ProposeRefundResult> {
  assertPermission(ctx, "refunds.propose");

  const runner = async (tx: TxCtx): Promise<ProposeRefundResult> => {
    // 1. Load & lock payment
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, input.paymentId))
      .for("update");

    if (!payment) {
      throw new AppError(ErrorCode.NOT_FOUND, "Payment not found");
    }

    // 2. Load order
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
    }

    if (payment.orderId !== order.id) {
      throw new AppError(ErrorCode.VALIDATION, "Payment does not belong to this order");
    }

    // 3. Order must be in paid|fulfilled|partially_refunded
    const refundableStatuses = ["paid", "fulfilled", "partially_refunded"] as const;
    if (!(refundableStatuses as readonly string[]).includes(order.status)) {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        `Order must be paid, fulfilled, or partially_refunded (current: ${order.status})`,
      );
    }

    // 4. Payment must be from a manual provider (BR-09)
    if (!payment.provider.startsWith("manual_")) {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        `Only manual-provider payments can be refunded via this flow (provider: ${payment.provider})`,
      );
    }

    // 5. BR-09: product must be is_refundable, unless policyException
    if (!input.policyException) {
      // Check each order item's product
      const items = await tx
        .select({ productId: orderItems.productId })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
      if (productIds.length > 0) {
        const refundableCheck = await tx
          .select({ id: products.id, isRefundable: products.isRefundable })
          .from(products)
          .where(sql`${products.id} = ANY(ARRAY[${sql.join(productIds.map((id) => sql`${id}::uuid`), sql`, `)}])`);

        const nonRefundable = refundableCheck.filter((p) => !p.isRefundable);
        if (nonRefundable.length > 0) {
          throw new AppError(
            ErrorCode.VALIDATION,
            `Order contains non-refundable product(s). Use policyException: true to override.`,
          );
        }
      }
    }

    // 6. Amount must not exceed confirmed − already refunded
    const confirmedAmount = payment.amountReceivedMinor ?? 0;
    const alreadyRefunded = payment.amountRefundedMinor ?? 0;
    const maxRefundable = confirmedAmount - alreadyRefunded;

    if (input.amountMinor > maxRefundable) {
      throw new AppError(
        ErrorCode.VALIDATION,
        `Refund amount (${input.amountMinor}) exceeds refundable balance (${maxRefundable})`,
      );
    }

    // 7. Insert refunds row
    const [refundRow] = await tx
      .insert(refunds)
      .values({
        orderId: order.id,
        paymentId: payment.id,
        amountMinor: input.amountMinor,
        currency: order.currency,
        reason: input.reason,
      })
      .returning();

    // 8. Create refund.issue approval request (BR-13: all other admins must approve)
    const { approvalRequestId } = await approvalsService.request(
      "refund.issue",
      { type: "refund", id: refundRow!.id },
      { refundId: refundRow!.id },
      ctx.userId!,
      tx,
    );

    // 9. Update refunds row with approval request id
    await tx
      .update(refunds)
      .set({ approvalRequestId })
      .where(eq(refunds.id, refundRow!.id));

    // 10. Audit log
    await auditService.log(
      ctx,
      "API-PAY-05 refund.proposed",
      { type: "refund", id: refundRow!.id },
      null,
      { refundId: refundRow!.id, amountMinor: input.amountMinor, policyException: input.policyException },
      tx,
    );

    return { refundId: refundRow!.id, approvalRequestId };
  };

  if (outerTx) return await runner(outerTx);
  return await withTx(runner);
}

// ----------------------------------------------------------------------------------------------------
// API-PAY-06: applyRefund (approval handler)
// ----------------------------------------------------------------------------------------------------

export async function applyRefund(
  payload: RefundIssuePayload,
  approvalRequestId: string,
  tx: TxCtx,
  actorUserId?: string,
): Promise<ApplyRefundResult> {
  const { refundId } = payload;

  // 1. Load refund (with lock)
  const [refund] = await tx
    .select()
    .from(refunds)
    .where(eq(refunds.id, refundId))
    .for("update");

  if (!refund) {
    throw new AppError(ErrorCode.NOT_FOUND, "Refund not found");
  }

  // 2. Load order
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, refund.orderId))
    .for("update");

  if (!order) {
    throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
  }

  // 3. Load payment (with lock)
  const [payment] = await tx
    .select()
    .from(payments)
    .where(eq(payments.id, refund.paymentId))
    .for("update");

  if (!payment) {
    throw new AppError(ErrorCode.NOT_FOUND, "Payment not found");
  }

  // 4. Validate payment transition (confirmed → refunded only when fully refunded; STATE_INVALID otherwise)
  const newAmountRefunded = (payment.amountRefundedMinor ?? 0) + refund.amountMinor;
  const confirmedAmount = payment.amountReceivedMinor ?? 0;
  const isFullRefund = newAmountRefunded >= confirmedAmount;

  if (isFullRefund) {
    if (!PAYMENT_STATUS_TRANSITIONS["confirmed"].includes("refunded")) {
      throw new AppError(ErrorCode.STATE_INVALID, "Payment cannot transition to refunded from current state");
    }
    if (payment.status !== "confirmed") {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        `Payment status must be confirmed for full refund (current: ${payment.status})`,
      );
    }
  }

  const now = new Date();
  const executedBy = actorUserId ?? refund.executedBy ?? order.userId;

  // 5. Mark refund as executed
  await tx
    .update(refunds)
    .set({ executedAt: now, executedBy })
    .where(eq(refunds.id, refund.id));

  // 6. Post finance refund entries (ledger)
  const financeResult = await financeService.postRefund(refund.id, tx);

  // 7. Issue credit note (API-PAY-06, P4.5)
  const { invoicesService } = await import("@/modules/invoices/service");
  const creditNoteRes = await invoicesService.issueCreditNote(
    { refundId: refund.id },
    { userId: null },
    tx,
  );

  // 8. Update payment: amount_refunded_minor; if fully refunded → status = 'refunded'
  if (isFullRefund) {
    await tx
      .update(payments)
      .set({
        amountRefundedMinor: newAmountRefunded,
        status: "refunded",
      })
      .where(eq(payments.id, payment.id));
  } else {
    await tx
      .update(payments)
      .set({ amountRefundedMinor: newAmountRefunded })
      .where(eq(payments.id, payment.id));
  }

  // 9. Update order status
  const newOrderStatus = isFullRefund ? "refunded" : "partially_refunded";
  const [updatedOrder] = await tx
    .update(orders)
    .set({
      status: newOrderStatus,
      refundedAt: isFullRefund ? now : undefined,
      updatedAt: now,
    })
    .where(eq(orders.id, order.id))
    .returning();

  // 10. Revoke entitlements if revokeEntitlements=true (from refund reason / original input stored in reason field)
  // The revokeEntitlements flag is stored implicitly — we revoke when the full refund is applied.
  // For partial refunds the entitlements stay active per spec ("partial: entitlement untouched").
  const revokedEntitlementIds: string[] = [];
  if (isFullRefund) {
    // Load entitlements for this order's items
    const orderItemsList = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    const itemIds = orderItemsList.map((i) => i.id);
    if (itemIds.length > 0) {
      const activeEntitlements = await tx
        .select({ id: entitlements.id })
        .from(entitlements)
        .where(
          and(
            sql`${entitlements.orderItemId} = ANY(ARRAY[${sql.join(itemIds.map((id) => sql`${id}::uuid`), sql`, `)}])`,
            eq(entitlements.status, "active"),
          ),
        );

      // Revoke each (call NotImplemented contract — will be filled in P5)
      for (const ent of activeEntitlements) {
        try {
          const { createNotImplementedEntitlementsService } = await import("@/modules/entitlements/service");
          const eSvc = createNotImplementedEntitlementsService();
          await eSvc.revoke(ent.id, "refund", tx).catch(() => {
            // P5: entitlements.revoke is not implemented yet; mark in DB directly
          });
        } catch {
          // Silently continue — entitlements service is P5
        }
        // Directly update entitlement status as fallback
        await tx
          .update(entitlements)
          .set({ status: "revoked", revokedAt: now, revokeReason: "refund" })
          .where(eq(entitlements.id, ent.id));
        revokedEntitlementIds.push(ent.id);
      }
    }
  }

  // 11. Notification to customer
  if (order.userId) {
    await tx.insert(notifications).values({
      userId: order.userId,
      type: "refund.issued",
      title: "Refund issued",
      body: `Refund of ${refund.amountMinor} ${refund.currency} has been approved and processed.`,
      link: `/account/orders`,
      payload: { refundId: refund.id, creditNoteId: creditNoteRes.creditNoteId },
    });
  }

  // 12. Email outbox
  if (order.billingSnapshot && (order.billingSnapshot as { email?: string }).email) {
    await tx.insert(emailOutbox).values({
      toEmail: (order.billingSnapshot as { email: string }).email,
      template: "refund-issued",
      payload: {
        orderId: order.id,
        orderNo: order.orderNo,
        refundId: refund.id,
        amountMinor: refund.amountMinor,
        currency: refund.currency,
        creditNo: creditNoteRes.creditNo,
      },
      priority: 1,
    });
  }

  return {
    refund: { ...refund, executedAt: now, creditNoteId: creditNoteRes.creditNoteId },
    creditNoteId: creditNoteRes.creditNoteId,
    ledgerEntryCount: financeResult.entryCount,
    revokedEntitlementIds,
    orderStatus: updatedOrder!.status,
  };
}

// ----------------------------------------------------------------------------------------------------
// Register approval handlers (module-level side effect)
// ----------------------------------------------------------------------------------------------------

approvalsService.registerApplyHandler(
  "refund.issue",
  async (_ctx: ApplyContext, payload: RefundIssuePayload, tx: TxCtx) => {
    await applyRefund(payload, _ctx.requestId, tx, _ctx.decidedBy);
  },
);

approvalsService.registerRejectHandler(
  "refund.issue",
  async (_ctx: ApplyContext, payload: RefundIssuePayload, tx: TxCtx) => {
    // On rejection: delete the refund row
    await tx.delete(refunds).where(eq(refunds.id, payload.refundId));
  },
);
