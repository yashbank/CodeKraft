/**
 * Payments service implementation (docs/06 §2.4 API-PAY-01..08, §4.1 orchestration, master plan §5).
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { type DbOrTx, type TxCtx, getDb, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { ordersService } from "@/modules/orders/service";
import { financeService } from "@/modules/finance/service";
import { quotesService } from "@/modules/quotes/service";
import { orders, payments } from "../../../drizzle/schema/commerce";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { userRoles } from "../../../drizzle/schema/auth";
import { emailOutbox, notifications } from "../../../drizzle/schema/notifications";
import type { PaymentsService } from "./contracts";
import type {
  PaymentInstructions,
  PaymentMethodKey,
  ProviderRegistry,
} from "./provider";
import { providerRegistry } from "./providers/registry";
import {
  type ApplyRefundResult,
  confirmPaymentInput,
  type ConfirmPaymentInput,
  type ConfirmPaymentResult,
  type FailPaymentInput,
  type FailPaymentResult,
  type FlagChargebackInput,
  type GetPaymentInstructionsInput,
  type ListPaymentsAwaitingInput,
  type PaymentAwaitingRow,
  type ProposeRefundInput,
  type ProposeRefundResult,
  type RefundIssuePayload,
  type SubmitPaymentReferenceInput,
  type SubmitPaymentReferenceResult,
  RESUBMIT_NOTIFY_WINDOW_MS,
} from "./types";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import { proposeRefund, applyRefund } from "./refunds";

export class DefaultPaymentsService implements PaymentsService {
  private readonly fallback = createNotImplementedPaymentsService();
  readonly providers: ProviderRegistry = providerRegistry;

  // -- API-PAY-01 getPaymentInstructions (query) --------------------------------------------------

  async getPaymentInstructions(
    ctx: RequestContext,
    input: GetPaymentInstructionsInput,
  ): Promise<PaymentInstructions> {
    const db = await getDb();
    const [row] = await db
      .select({
        payment: payments,
        order: orders,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(eq(payments.id, input.paymentId))
      .limit(1);

    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, "Payment not found");
    }

    const isAdmin = ctx.roles.includes("admin") || ctx.roles.includes("super_admin");
    if (row.order.userId !== ctx.userId && !isAdmin) {
      throw new AppError(ErrorCode.NOT_FOUND, "Payment not found");
    }

    if (!row.payment.instructions) {
      throw new AppError(ErrorCode.STATE_INVALID, "Payment instructions not available");
    }

    return row.payment.instructions as unknown as PaymentInstructions;
  }

  // -- API-PAY-02 submitPaymentReference ----------------------------------------------------------

  async submitPaymentReference(
    ctx: RequestContext,
    input: SubmitPaymentReferenceInput,
    outerTx?: TxCtx,
  ): Promise<SubmitPaymentReferenceResult> {
    const runner = async (tx: TxCtx): Promise<SubmitPaymentReferenceResult> => {
      const [row] = await tx
        .select({
          payment: payments,
          order: orders,
        })
        .from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(eq(payments.id, input.paymentId))
        .limit(1);

      if (!row) {
        throw new AppError(ErrorCode.NOT_FOUND, "Payment not found");
      }

      const isAdmin = ctx.roles.includes("admin") || ctx.roles.includes("super_admin");
      if (row.order.userId !== ctx.userId && !isAdmin) {
        throw new AppError(ErrorCode.NOT_FOUND, "Payment not found");
      }

      const now = new Date();
      if (row.order.expiresAt && row.order.expiresAt < now) {
        throw new AppError(ErrorCode.ORDER_EXPIRED, "Order has expired");
      }

      if (row.payment.status !== "initiated" && row.payment.status !== "submitted") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot submit reference on payment with status '${row.payment.status}'`,
        );
      }

      const isResubmission = row.payment.status === "submitted";
      const lastSubmittedAt = row.payment.customerSubmittedAt;
      const shouldNotify =
        !isResubmission ||
        !lastSubmittedAt ||
        now.getTime() - lastSubmittedAt.getTime() > RESUBMIT_NOTIFY_WINDOW_MS;

      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: "submitted",
          customerReference: input.reference,
          customerSubmittedAt: now,
        })
        .where(eq(payments.id, input.paymentId))
        .returning();

      if (shouldNotify) {
        const adminUsers = await tx
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .where(inArray(userRoles.roleKey, ["admin", "super_admin"]));

        for (const admin of adminUsers) {
          if (!admin.userId) continue;
          await tx.insert(notifications).values({
            userId: admin.userId,
            type: "payment.submitted",
            title: "Payment submitted",
            body: `Customer submitted reference ${input.reference} for order ${row.order.orderNo}`,
            link: `/admin/orders/${row.order.id}`,
            payload: {
              paymentId: input.paymentId,
              orderId: row.order.id,
              reference: input.reference,
            },
          });
        }
      }

      await auditService.log(
        ctx,
        "payment.submitted",
        { type: "payment", id: input.paymentId },
        row.payment,
        updatedPayment,
        tx,
      );

      return { payment: { paymentId: input.paymentId, status: "submitted" } };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  // -- API-PAY-03 confirmPayment ------------------------------------------------------------------

  async confirmPayment(
    ctx: RequestContext,
    input: ConfirmPaymentInput,
    outerTx?: TxCtx,
  ): Promise<ConfirmPaymentResult> {
    assertPermission(ctx, "payments.confirm");
    const parsed = confirmPaymentInput.parse(input);

    const runner = async (tx: TxCtx): Promise<ConfirmPaymentResult> => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, parsed.paymentId))
        .for("update");

      if (!payment) {
        throw new AppError(ErrorCode.NOT_FOUND, "Payment not found");
      }

      // Idempotency check per docs/06 §1.5
      if (payment.status === "confirmed") {
        if (
          payment.amountReceivedMinor === parsed.amountReceivedMinor &&
          (payment.customerReference === parsed.reference || !parsed.reference)
        ) {
          throw new AppError(ErrorCode.IDEMPOTENT_REPLAY, "Payment already confirmed");
        }
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Payment already confirmed with different values",
        );
      }

      if (payment.status !== "initiated" && payment.status !== "submitted") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot confirm payment with status '${payment.status}'`,
        );
      }

      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, payment.orderId))
        .limit(1);

      if (!order) {
        throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
      }

      const now = new Date();
      if (order.expiresAt && order.expiresAt < now && !parsed.overrideExpiry) {
        throw new AppError(ErrorCode.ORDER_EXPIRED, "Order has expired");
      }

      if (order.type === "project") {
        if (!order.splitApprovalRequestId) {
          throw new AppError(
            ErrorCode.STATE_INVALID,
            "Project order requires split approval before confirmation",
          );
        }
        const [approval] = await tx
          .select()
          .from(approvalRequests)
          .where(eq(approvalRequests.id, order.splitApprovalRequestId))
          .limit(1);
        if (!approval || approval.status !== "applied") {
          throw new AppError(
            ErrorCode.STATE_INVALID,
            "Project order split approval must be applied",
          );
        }
      }

      const provider = this.providers.get(payment.provider as PaymentMethodKey);
      const result = await provider.confirm(tx, payment, {
        amountReceivedMinor: parsed.amountReceivedMinor,
        reference: parsed.reference,
        receivedOn: parsed.receivedOn,
        actorId: ctx.userId,
      });

      const [confirmedPayment] = await tx
        .update(payments)
        .set({
          status: "confirmed",
          amountReceivedMinor: result.amountReceivedMinor,
          bankShortfallMinor: result.bankShortfallMinor,
          customerCreditMinor: result.customerCreditMinor,
          customerReference: parsed.reference || payment.customerReference,
          confirmedBy: ctx.userId,
          confirmedAt: now,
        })
        .where(eq(payments.id, payment.id))
        .returning();

      if (parsed.dropCoupon && order.couponId) {
        await tx
          .update(orders)
          .set({
            couponId: null,
            discountMinor: 0,
            totalMinor: order.subtotalMinor + order.taxMinor,
          })
          .where(eq(orders.id, order.id));
      }

      // Mark order paid (redeems coupon + populates user_offering_purchases)
      let updatedOrder;
      try {
        updatedOrder = await ordersService.markPaid(order.id, now, tx);
      } catch (err) {
        if (err instanceof AppError && err.code === ErrorCode.LIMIT_EXCEEDED) {
          throw new AppError(
            ErrorCode.LIMIT_EXCEEDED,
            "Coupon limit exceeded. Confirm without coupon using dropCoupon: true.",
          );
        }
        throw err;
      }

      // Post to finance (creates ledger entries and allocation snapshot)
      const financeRes = await financeService.postOrderPaid(order.id, tx);

      // Issue invoice (API-COM-11, P4.5)
      const { invoicesService } = await import("@/modules/invoices/service");
      const invoiceRes = await invoicesService.issueInvoice(
        { orderId: order.id },
        { userId: ctx.userId },
        tx,
      );

      // Custom quote mark paid hook
      if (order.customQuoteId) {
        await quotesService.markPaid(order.customQuoteId, tx);
      }

      // Customer notification
      if (order.userId) {
        await tx.insert(notifications).values({
          userId: order.userId,
          type: "order.paid",
          title: "Order paid",
          body: `Payment confirmed for order ${order.orderNo}`,
          link: `/account/orders`,
          payload: { orderId: order.id, orderNo: order.orderNo },
        });
      }

      // Email outbox
      if (order.billingSnapshot?.email) {
        await tx.insert(emailOutbox).values({
          toEmail: order.billingSnapshot.email,
          template: "payment-confirmed",
          payload: {
            orderId: order.id,
            orderNo: order.orderNo,
            amountPaid: (result.amountReceivedMinor / 100).toFixed(2),
            currency: order.currency,
          },
          priority: 1,
        });
      }

      // Audit log
      await auditService.log(
        ctx,
        "payment.confirmed",
        { type: "payment", id: payment.id },
        payment,
        confirmedPayment,
        tx,
      );

      return {
        payment: confirmedPayment!,
        order: updatedOrder,
        invoiceNo: invoiceRes.invoiceNo,
        invoiceId: invoiceRes.invoiceId,
        entitlementIds: [],
        ledgerEntryCount: financeRes.entryCount,
        shortfallMinor: result.bankShortfallMinor,
        customerCreditMinor: result.customerCreditMinor,
      };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  // -- API-PAY-04 failPayment --------------------------------------------------------------------

  async failPayment(
    ctx: RequestContext,
    input: FailPaymentInput,
    outerTx?: TxCtx,
  ): Promise<FailPaymentResult> {
    assertPermission(ctx, "payments.confirm");

    const runner = async (tx: TxCtx): Promise<FailPaymentResult> => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, input.paymentId))
        .for("update");

      if (!payment) {
        throw new AppError(ErrorCode.NOT_FOUND, "Payment not found");
      }

      if (payment.status === "confirmed") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Cannot fail an already confirmed payment",
        );
      }

      const now = new Date();
      const [failedPayment] = await tx
        .update(payments)
        .set({
          status: "failed",
          failureReason: input.reason,
        })
        .where(eq(payments.id, payment.id))
        .returning();

      let [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, payment.orderId))
        .limit(1);

      if (!order) {
        throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
      }

      if (input.alsoCancelOrder) {
        const [cancelledOrder] = await tx
          .update(orders)
          .set({
            status: "cancelled",
            cancelledAt: now,
            updatedAt: now,
          })
          .where(eq(orders.id, order.id))
          .returning();
        order = cancelledOrder!;
      }

      if (order.billingSnapshot?.email) {
        await tx.insert(emailOutbox).values({
          toEmail: order.billingSnapshot.email,
          template: "payment-failed",
          payload: {
            orderId: order.id,
            orderNo: order.orderNo,
            reason: input.reason,
          },
          priority: 5,
        });
      }

      await auditService.log(
        ctx,
        "payment.failed",
        { type: "payment", id: payment.id },
        payment,
        failedPayment,
        tx,
      );

      return { payment: failedPayment!, order };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  // -- API-PAY-05 proposeRefund & API-PAY-06 applyRefund ------------------------------------------

  async proposeRefund(
    ctx: RequestContext,
    input: ProposeRefundInput,
    tx?: TxCtx,
  ): Promise<ProposeRefundResult> {
    return await proposeRefund(ctx, input, tx);
  }

  async applyRefund(
    payload: RefundIssuePayload,
    approvalRequestId: string,
    tx: TxCtx,
  ): Promise<ApplyRefundResult> {
    return await applyRefund(payload, approvalRequestId, tx);
  }

  // -- API-PAY-07 listPaymentsAwaiting ------------------------------------------------------------

  async listPaymentsAwaiting(
    ctx: RequestContext,
    input: ListPaymentsAwaitingInput,
  ): Promise<PaymentAwaitingRow[]> {
    assertPermission(ctx, "orders.read");
    const db = await getDb();

    const statuses = input.status ? [input.status] : ["submitted", "initiated"];

    const rows = await db
      .select({
        payment: payments,
        order: orders,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(inArray(payments.status, statuses as any))
      .orderBy(desc(payments.createdAt));

    const now = new Date();
    return rows.map((r) => {
      const ageHours = Math.max(
        0,
        Math.floor((now.getTime() - r.payment.createdAt.getTime()) / 3600_000),
      );
      return {
        paymentId: r.payment.id,
        status: r.payment.status as "submitted" | "initiated",
        ageHours,
        order: {
          orderId: r.order.id,
          orderNo: r.order.orderNo,
          totalMinor: r.order.totalMinor,
          currency: r.order.currency,
          expiresAt: r.order.expiresAt ? r.order.expiresAt.toISOString() : null,
        },
        customer: {
          userId: r.order.userId,
          name: r.order.billingSnapshot?.name || "Customer",
          email: r.order.billingSnapshot?.email || "",
        },
        customerReference: r.payment.customerReference,
        customerSubmittedAt: r.payment.customerSubmittedAt
          ? r.payment.customerSubmittedAt.toISOString()
          : null,
      };
    });
  }

  // -- API-PAY-08 flagChargeback ------------------------------------------------------------------

  async flagChargeback(
    ctx: RequestContext,
    input: FlagChargebackInput,
    tx?: TxCtx,
  ): Promise<{ ok: true }> {
    assertPermission(ctx, "payments.confirm");
    const db: DbOrTx = tx ?? (await getDb());
    await db
      .update(payments)
      .set({ failureReason: `chargeback: ${input.note}` })
      .where(eq(payments.id, input.paymentId));
    return { ok: true };
  }

  // -- internal, used by orders -------------------------------------------------------------------

  async createIntentForOrder(
    orderId: string,
    method: PaymentMethodKey,
    tx: TxCtx,
  ): Promise<{ paymentId: string; instructions: PaymentInstructions }> {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
    }

    const provider = this.providers.get(method);
    const intent = await provider.createIntent(
      tx,
      {
        orderId: order.id,
        orderNo: order.orderNo,
        amountDue: {
          amountMinor: order.totalMinor,
          currency: order.currency as any,
        },
        customer: {
          name: order.billingSnapshot?.name || "",
          email: order.billingSnapshot?.email || "",
        },
      },
      method,
    );

    const [payment] = await tx
      .insert(payments)
      .values({
        orderId: order.id,
        provider: method,
        status: "initiated",
        amountDueMinor: order.totalMinor,
        currency: order.currency,
        instructions: intent.instructions as any,
        providerPayload: intent.providerPayload as Record<string, unknown> | undefined,
      })
      .returning();

    return {
      paymentId: payment!.id,
      instructions: intent.instructions,
    };
  }
}

export const paymentsService: PaymentsService = new DefaultPaymentsService();

/** Preserved for freeze tests (PHASE-02 P2.8). */
export function createNotImplementedPaymentsService(): PaymentsService {
  return createNotImplemented<PaymentsService>("payments", "P4", {
    providers: {
      value: createNotImplemented<ProviderRegistry>("payments.providers", "P4", {
        get: "sync",
        has: "sync",
        register: "sync",
        enabledMethods: "sync",
      }),
    },
    getPaymentInstructions: "async",
    submitPaymentReference: "async",
    confirmPayment: "async",
    failPayment: "async",
    proposeRefund: "async",
    applyRefund: "async",
    listPaymentsAwaiting: "async",
    flagChargeback: "async",
    createIntentForOrder: "async",
  });
}
