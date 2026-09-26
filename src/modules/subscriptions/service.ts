import { and, eq, lte, or, sql } from "drizzle-orm";
import { type TxCtx, getDb, withTx } from "@/lib/db";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";
import { auditService } from "@/modules/audit/service";
import { paymentsService } from "@/modules/payments/service";
import { defaultDeliveryHandlerRegistry } from "@/modules/delivery/handlers";
import {
  entitlements,
  subscriptions,
  type Subscription,
} from "../../../drizzle/schema/delivery";
import { orders, orderItems } from "../../../drizzle/schema/commerce";
import { offerings, offeringPrices } from "../../../drizzle/schema/offerings";
import { products } from "../../../drizzle/schema/catalog";
import { users } from "../../../drizzle/schema/auth";
import type { SubscriptionsService } from "./contracts";
import {
  type BillingInterval,
  type CancelSubscriptionAdminInput,
  type CancelSubscriptionInput,
  type RemindGraceSuspendDetail,
  type RenewSubscriptionInput,
  type RenewalOrderResult,
  type SubscriptionDetail,
  cancelSubscriptionAdminSchema,
  cancelSubscriptionSchema,
  renewSubscriptionSchema,
} from "./types";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";

export function advancePeriod(from: Date, interval: BillingInterval): Date {
  const result = new Date(from.getTime());
  const day = result.getUTCDate();
  const months = interval === "monthly" ? 1 : interval === "quarterly" ? 3 : 12;
  result.setUTCMonth(result.getUTCMonth() + months);
  if (result.getUTCDate() !== day) {
    result.setUTCDate(0);
  }
  return result;
}

export class DefaultSubscriptionsService implements SubscriptionsService {
  constructor(private readonly registry = defaultDeliveryHandlerRegistry) {}

  async renew(
    ctx: RequestContext,
    rawInput: RenewSubscriptionInput,
  ): Promise<RenewalOrderResult> {
    assertPermission(ctx, "commerce.self");
    const input = renewSubscriptionSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [sub] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.entitlementId, input.entitlementId))
        .for("update");

      if (!sub) {
        throw new AppError(ErrorCode.NOT_FOUND, "Subscription not found");
      }

      if (sub.status === "cancelled") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Cannot renew a cancelled subscription",
        );
      }

      const [ent] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, sub.entitlementId));

      if (!ent || (ctx.userId && ent.userId !== ctx.userId && !ctx.roles.includes("super_admin") && !ctx.roles.includes("admin"))) {
        throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
      }

      // If existing pending renewal order exists, return it (idempotency)
      if (sub.renewalOrderId) {
        const [existingOrder] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, sub.renewalOrderId));

        if (existingOrder && existingOrder.status === "pending_payment") {
          const intent = await paymentsService.createIntentForOrder(
            existingOrder.id,
            input.paymentMethod,
            tx,
          );
          return {
            orderId: existingOrder.id,
            orderNo: existingOrder.orderNo,
            payment: {
              paymentId: intent.paymentId,
              method: input.paymentMethod,
              instructions: intent.instructions as unknown as Record<string, unknown>,
            },
            expiresAt: (existingOrder.expiresAt ?? sub.graceUntil ?? sub.currentPeriodEnd).toISOString(),
            existing: true,
          };
        }
      }

      // Load offering to get current price
      const [offering] = await tx
        .select()
        .from(offerings)
        .where(eq(offerings.id, ent.offeringId));

      if (!offering) {
        throw new AppError(ErrorCode.NOT_FOUND, "Offering not found");
      }

      const [price] = await tx
        .select()
        .from(offeringPrices)
        .where(and(eq(offeringPrices.offeringId, offering.id), eq(offeringPrices.currency, "INR")));

      const unitMinor = price?.amountMinor ?? 10000;
      const orderExpiresAt = sub.graceUntil ?? new Date(sub.currentPeriodEnd.getTime() + 7 * 86400000);

      // Determine billing info
      const [user] = await tx.select().from(users).where(eq(users.id, ent.userId));
      const billing = input.billing ?? {
        name: user?.name ?? "Customer",
        email: user?.email ?? "customer@example.com",
        country: "IN",
      };

      const orderNo = `CK-ORD-${Math.floor(100000 + Math.random() * 900000)}`;

      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNo,
          type: "product",
          userId: ent.userId,
          status: "pending_payment",
          currency: "INR",
          subtotalMinor: unitMinor,
          discountMinor: 0,
          taxMinor: 0,
          totalMinor: unitMinor,
          taxRateBps: 0,
          fxRateToInr: "1",
          billingSnapshot: billing,
          expiresAt: orderExpiresAt,
          createdBy: ctx.userId ?? ent.userId,
        })
        .returning();

      await tx.insert(orderItems).values({
        orderId: newOrder!.id,
        offeringId: offering.id,
        productId: ent.productId,
        description: `${offering.name} (Renewal)`,
        quantity: 1,
        unitMinor,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: unitMinor,
      });

      // Link renewal order
      await tx
        .update(subscriptions)
        .set({
          renewalOrderId: newOrder!.id,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id));

      const intent = await paymentsService.createIntentForOrder(
        newOrder!.id,
        input.paymentMethod,
        tx,
      );

      return {
        orderId: newOrder!.id,
        orderNo: newOrder!.orderNo,
        payment: {
          paymentId: intent.paymentId,
          method: input.paymentMethod,
          instructions: intent.instructions as unknown as Record<string, unknown>,
        },
        expiresAt: orderExpiresAt.toISOString(),
        existing: false,
      };
    });
  }

  async onRenewalPaid(orderId: string, tx: TxCtx): Promise<SubscriptionDetail> {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
    }

    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.renewalOrderId, order.id))
      .for("update");

    if (!sub) {
      throw new AppError(ErrorCode.NOT_FOUND, "Subscription for renewal order not found");
    }

    const now = new Date();
    // Extend from currentPeriodEnd if not suspended, else from now
    const baseStart = sub.status === "suspended" ? now : sub.currentPeriodEnd;
    const newEnd = advancePeriod(baseStart, sub.interval as BillingInterval);

    const [updatedSub] = await tx
      .update(subscriptions)
      .set({
        currentPeriodStart: baseStart,
        currentPeriodEnd: newEnd,
        graceUntil: null,
        status: "active",
        cancelAtPeriodEnd: false,
        renewalOrderId: null,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id))
      .returning();

    // Re-activate entitlement if suspended
    await tx
      .update(entitlements)
      .set({
        status: "active",
        accessEndsAt: newEnd,
        updatedAt: now,
      })
      .where(eq(entitlements.id, sub.entitlementId));

    return this.toDetail(updatedSub!);
  }

  async cancelAtPeriodEnd(
    ctx: RequestContext,
    rawInput: CancelSubscriptionInput,
  ): Promise<SubscriptionDetail> {
    assertPermission(ctx, "delivery.self");
    const input = cancelSubscriptionSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [sub] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.entitlementId, input.entitlementId))
        .for("update");

      if (!sub) {
        throw new AppError(ErrorCode.NOT_FOUND, "Subscription not found");
      }

      const [updated] = await tx
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id))
        .returning();

      await auditService.log(
        ctx,
        "subscription.cancelled_period_end",
        { type: "subscription", id: sub.id },
        { cancelAtPeriodEnd: sub.cancelAtPeriodEnd },
        { cancelAtPeriodEnd: true, reason: input.reason },
        tx,
      );

      return this.toDetail(updated!);
    });
  }

  async cancelAdmin(
    ctx: RequestContext,
    rawInput: CancelSubscriptionAdminInput,
  ): Promise<SubscriptionDetail> {
    assertPermission(ctx, "entitlements.admin");
    const input = cancelSubscriptionAdminSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [sub] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.entitlementId, input.entitlementId))
        .for("update");

      if (!sub) {
        throw new AppError(ErrorCode.NOT_FOUND, "Subscription not found");
      }

      const now = new Date();
      if (input.immediate) {
        const [updated] = await tx
          .update(subscriptions)
          .set({
            status: "cancelled",
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id))
          .returning();

        // Expire entitlement immediately
        await tx
          .update(entitlements)
          .set({
            status: "expired",
            accessEndsAt: now,
            updatedAt: now,
          })
          .where(eq(entitlements.id, sub.entitlementId));

        await auditService.log(
          ctx,
          "subscription.cancelled_admin",
          { type: "subscription", id: sub.id },
          { status: sub.status },
          { status: "cancelled", immediate: true, reason: input.reason },
          tx,
        );

        return this.toDetail(updated!);
      } else {
        const [updated] = await tx
          .update(subscriptions)
          .set({
            cancelAtPeriodEnd: true,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id))
          .returning();

        await auditService.log(
          ctx,
          "subscription.cancelled_admin",
          { type: "subscription", id: sub.id },
          { cancelAtPeriodEnd: sub.cancelAtPeriodEnd },
          { cancelAtPeriodEnd: true, immediate: false, reason: input.reason },
          tx,
        );

        return this.toDetail(updated!);
      }
    });
  }

  async runRemindGraceSuspendJob(job: JobContext): Promise<JobOutcome<RemindGraceSuspendDetail>> {
    return await withTx(async (tx) => {
      const now = job.now ?? new Date();
      let reminded7d = 0;
      let reminded1d = 0;
      let movedToPastDue = 0;
      let suspended = 0;
      let cancelled = 0;
      let revokeTasks = 0;

      // 1. Move expired active subscriptions to past_due (grace period 7 days)
      const dueSubs = await tx
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, "active"),
            lte(subscriptions.currentPeriodEnd, now),
            eq(subscriptions.cancelAtPeriodEnd, false),
          ),
        );

      for (const sub of dueSubs) {
        const graceUntil = new Date(sub.currentPeriodEnd.getTime() + 7 * 86400000);
        await tx
          .update(subscriptions)
          .set({
            status: "past_due",
            graceUntil,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));
        movedToPastDue++;
      }

      // 2. Cancel at period end that reached period end -> cancelled & expired
      const cancelSubs = await tx
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.cancelAtPeriodEnd, true),
            lte(subscriptions.currentPeriodEnd, now),
            or(eq(subscriptions.status, "active"), eq(subscriptions.status, "past_due")),
          ),
        );

      for (const sub of cancelSubs) {
        await tx
          .update(subscriptions)
          .set({
            status: "cancelled",
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));

        await tx
          .update(entitlements)
          .set({
            status: "expired",
            accessEndsAt: now,
            updatedAt: now,
          })
          .where(eq(entitlements.id, sub.entitlementId));
        cancelled++;
      }

      // 3. Past due past grace -> suspended
      const pastGrace = await tx
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, "past_due"),
            lte(subscriptions.graceUntil, now),
          ),
        );

      for (const sub of pastGrace) {
        await tx
          .update(subscriptions)
          .set({
            status: "suspended",
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));

        const [ent] = await tx
          .select()
          .from(entitlements)
          .where(eq(entitlements.id, sub.entitlementId));

        if (ent) {
          await tx
            .update(entitlements)
            .set({
              status: "suspended",
              updatedAt: now,
            })
            .where(eq(entitlements.id, ent.id));

          const handler = this.registry.get(ent.deliveryType);
          const [offering] = await tx
            .select()
            .from(offerings)
            .where(eq(offerings.id, ent.offeringId));
          const [product] = await tx
            .select()
            .from(products)
            .where(eq(products.id, ent.productId));
          const [user] = await tx
            .select()
            .from(users)
            .where(eq(users.id, ent.userId));

          const handlerCtx = {
            actorId: null,
            requestId: job.jobId,
            offering: {
              id: offering!.id,
              name: offering!.name,
              deliveryConfig: offering!.deliveryConfig as any,
              serviceSteps: offering!.serviceSteps as any,
              purchaseModel: offering!.purchaseModel as any,
            },
            product: { id: product!.id, name: product!.name, slug: product!.slug },
            customer: { id: user!.id, email: user!.email, name: user!.name },
            subscription: sub,
            manualGrant: ent.orderItemId === null,
          };

          const revokeRes = await handler.onRevoked(
            handlerCtx,
            ent,
            { mode: "soft", reason: "subscription_suspended" },
            tx,
          );
          if (revokeRes.taskId) revokeTasks++;
        }
        suspended++;
      }

      const detail: RemindGraceSuspendDetail = {
        reminded7d,
        reminded1d,
        movedToPastDue,
        suspended,
        cancelled,
        revokeTasks,
      };

      return {
        ok: true,
        detail,
      };
    });
  }

  private toDetail(sub: Subscription): SubscriptionDetail {
    return {
      subscriptionId: sub.id,
      entitlementId: sub.entitlementId,
      interval: sub.interval as BillingInterval,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      graceUntil: sub.graceUntil ? sub.graceUntil.toISOString() : null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      renewalOrderId: sub.renewalOrderId,
      reminderSentAt: sub.reminderSentAt ? sub.reminderSentAt.toISOString() : null,
    };
  }
}

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export const subscriptionsService = new DefaultSubscriptionsService();

export function createNotImplementedSubscriptionsService(): SubscriptionsService {
  return createNotImplemented<SubscriptionsService>("subscriptions", "P5", {
    renewSubscription: "async",
    cancelSubscription: "async",
    cancelSubscriptionAdmin: "async",
    processRemindersAndGrace: "async",
  });
}
