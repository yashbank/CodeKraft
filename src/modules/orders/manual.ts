/**
 * Manual & project orders implementation (API-COM-07, FR-COM-10..12, BR-05, MASTER_SPEC §7).
 */
import { and, eq } from "drizzle-orm";
import { type TxCtx, withTx } from "@/lib/db";
import {
  orderItems,
  orders,
  userOfferingPurchases,
} from "../../../drizzle/schema/commerce";
import { offerings, offeringPrices } from "../../../drizzle/schema/offerings";
import { products } from "../../../drizzle/schema/catalog";
import { users } from "../../../drizzle/schema/auth";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { approvalsService } from "@/modules/approvals/service";
import { paymentsService } from "@/modules/payments/service";
import { ownershipService } from "@/modules/ownership/service";
import { settingsService } from "@/modules/settings/service";
import { effectiveTaxRateBps } from "@/modules/settings/tax";
import { calculateItemPricing } from "./totals";
import { nextOrderNo } from "./numbering";
import {
  type CreateManualOrderInput,
  type CreateManualOrderResult,
  createManualOrderInput,
  isProjectLine,
  type SplitSnapshot,
  toSplitSnapshot,
} from "./types";

export async function createManualOrder(
  ctx: RequestContext,
  rawInput: CreateManualOrderInput,
  outerTx?: TxCtx,
): Promise<CreateManualOrderResult> {
  assertPermission(ctx, "orders.manual.write");
  const input = createManualOrderInput.parse(rawInput);

  const runner = async (tx: TxCtx): Promise<CreateManualOrderResult> => {
    // 1. Determine customer identity
    let userId: string | null = null;
    let clientName: string | null = null;
    let clientEmail: string | null = null;
    let clientCompany: string | null = null;

    if ("userId" in input.customer) {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.customer.userId))
        .limit(1);

      if (!user) {
        throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
      }
      userId = user.id;
    } else {
      clientName = input.customer.clientName;
      clientEmail = input.customer.clientEmail;
      clientCompany = input.customer.clientCompany ?? null;
    }

    // 2. Tax rate from settings
    const settings = await settingsService.load(tx);
    const taxRateBps = effectiveTaxRateBps({ taxEnabled: input.taxEnabled }, settings);

    // 3. Process items
    const preparedItems: {
      offeringId: string | null;
      productId: string | null;
      description: string;
      quantity: number;
      unitMinor: number;
      discountMinor: number;
      taxMinor: number;
      totalMinor: number;
      ownershipId: string | null;
      splitSnapshot: SplitSnapshot | null;
    }[] = [];

    if (input.type === "product") {
      for (const item of input.items) {
        if (isProjectLine(item)) {
          throw new AppError(
            ErrorCode.VALIDATION,
            "Product orders take offering lines",
          );
        }

        const [offering] = await tx
          .select()
          .from(offerings)
          .where(eq(offerings.id, item.offeringId))
          .limit(1);

        if (!offering || offering.status !== "active") {
          throw new AppError(ErrorCode.NOT_FOUND, "Offering not found or not active");
        }

        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, offering.productId))
          .limit(1);

        if (!product) {
          throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
        }

        // BR-10 duplicate purchase prevention for one_time offerings
        if (offering.purchaseModel === "one_time" && userId) {
          const [existing] = await tx
            .select()
            .from(userOfferingPurchases)
            .where(
              and(
                eq(userOfferingPurchases.userId, userId),
                eq(userOfferingPurchases.offeringId, offering.id),
              ),
            )
            .limit(1);

          if (existing) {
            throw new AppError(
              ErrorCode.DUPLICATE_PURCHASE,
              "User has already purchased this offering",
            );
          }
        }

        const activeOwnership = await ownershipService.getActiveAt(product.id, new Date(), tx);
        if (!activeOwnership) {
          throw new AppError(
            ErrorCode.STATE_INVALID,
            `Product ${product.id} has no active ownership`,
          );
        }

        const prices = await tx
          .select()
          .from(offeringPrices)
          .where(eq(offeringPrices.offeringId, offering.id));

        const basePrice = prices.find((p) => p.currency === input.currency) ?? prices[0];
        if (!basePrice) {
          throw new AppError(ErrorCode.STATE_INVALID, "No price configured for offering");
        }
        const unitMinor = basePrice.amountMinor;

        const pricing = calculateItemPricing({
          unitMinor,
          quantity: 1,
          taxRateBps,
        });

        preparedItems.push({
          offeringId: offering.id,
          productId: product.id,
          description: offering.name,
          quantity: 1,
          unitMinor,
          discountMinor: 0,
          taxMinor: pricing.taxMinor,
          totalMinor: pricing.totalMinor,
          ownershipId: activeOwnership.id,
          splitSnapshot: null,
        });
      }
    } else {
      // type === "project"
      for (const item of input.items) {
        if (!isProjectLine(item)) {
          throw new AppError(
            ErrorCode.VALIDATION,
            "Project orders take project lines",
          );
        }

        const pricing = calculateItemPricing({
          unitMinor: item.unitMinor,
          quantity: item.quantity,
          taxRateBps,
        });

        let productId: string | null = null;
        let ownershipId: string | null = null;
        let splitSnapshot: SplitSnapshot | null = null;

        if (item.productId) {
          const [product] = await tx
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);

          if (!product) {
            throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
          }

          const activeOwnership = await ownershipService.getActiveAt(product.id, new Date(), tx);
          if (!activeOwnership) {
            throw new AppError(
              ErrorCode.STATE_INVALID,
              `Product ${product.id} has no active ownership`,
            );
          }
          productId = product.id;
          ownershipId = activeOwnership.id;
        }

        if (item.splitSnapshot) {
          splitSnapshot = toSplitSnapshot(item.splitSnapshot);
        }

        preparedItems.push({
          offeringId: null,
          productId,
          description: item.description,
          quantity: item.quantity,
          unitMinor: item.unitMinor,
          discountMinor: 0,
          taxMinor: pricing.taxMinor,
          totalMinor: pricing.totalMinor,
          ownershipId,
          splitSnapshot,
        });
      }
    }

    // 4. Calculate order totals
    const subtotalMinor = preparedItems.reduce(
      (acc, it) => acc + it.unitMinor * it.quantity,
      0,
    );
    const discountMinor = Math.min(
      subtotalMinor,
      Math.max(0, input.discountMinor ?? 0),
    );
    const taxMinor = preparedItems.reduce((acc, it) => acc + it.taxMinor, 0);
    const totalMinor = subtotalMinor - discountMinor + taxMinor;

    const orderNo = await nextOrderNo(tx);
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000);

    // 5. Create order
    const [order] = await tx
      .insert(orders)
      .values({
        orderNo,
        type: input.type,
        userId,
        clientName,
        clientEmail,
        clientCompany,
        status: "pending_payment",
        currency: input.currency,
        subtotalMinor,
        discountMinor,
        taxMinor,
        totalMinor,
        billingSnapshot: input.billing,
        taxRateBps,
        fxRateToInr: "1.0",
        expiresAt,
        createdBy: ctx.userId,
      })
      .returning();

    // 6. Insert order items
    await tx.insert(orderItems).values(
      preparedItems.map((it) => ({
        orderId: order!.id,
        ...it,
      })),
    );

    // 7. If project order, create approval request
    let approvalRequestId: string | undefined = undefined;
    if (input.type === "project") {
      const req = await approvalsService.request(
        "project_order.split",
        { type: "order", id: order!.id },
        { orderId: order!.id },
        ctx.userId!,
        tx,
      );
      approvalRequestId = req.approvalRequestId;
    }

    // 8. If product order with immediate payment, create intent & confirm
    let paymentId: string | undefined = undefined;
    let invoiceId: string | undefined = undefined;

    if (input.type === "product" && input.payment) {
      const intent = await paymentsService.createIntentForOrder(
        order!.id,
        input.payment.method,
        tx,
      );
      paymentId = intent.paymentId;

      const confirmResult = await paymentsService.confirmPayment(
        ctx,
        {
          paymentId: intent.paymentId,
          amountReceivedMinor: input.payment.amountReceivedMinor,
          reference: input.payment.reference,
          receivedOn: input.payment.paidOn,
        },
        tx,
      );
      invoiceId = confirmResult.invoiceId ?? undefined;
    }

    // 9. Audit log
    await auditService.log(
      ctx,
      "order.created",
      { type: "order", id: order!.id },
      null,
      {
        orderNo: order!.orderNo,
        type: order!.type,
        totalMinor: order!.totalMinor,
        currency: order!.currency,
      },
      tx,
    );

    return {
      orderId: order!.id,
      orderNo: order!.orderNo,
      approvalRequestId,
      paymentId,
      invoiceId,
    };
  };

  if (outerTx) return await runner(outerTx);
  return await withTx(runner);
}
