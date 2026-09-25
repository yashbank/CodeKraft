/**
 * API-COM-07 `createManualOrder` (PHASE-04 P4.7, D-1107, A-502, BR-05, MASTER_SPEC §7 "Project
 * order splits"). Product orders take offering lines for an existing customer and may be created
 * and confirmed in one transaction (API-PAY-03 runs inside); project orders take free-form lines
 * with a `split_snapshot` each and open a `project_order.split` approval request — they cannot be
 * invoiced or paid until it is applied.
 */
import { and, eq } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { type TxCtx, withTx } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { AppError, ErrorCode } from "@/lib/errors";
import { users } from "../../../drizzle/schema/auth";
import { userOfferingPurchases } from "../../../drizzle/schema/commerce";
import { invoices } from "../../../drizzle/schema/invoices";
import type { OrderLineInsert, OrdersModule } from "./service";
import { activeOwnershipId } from "./deps";
import { computeLine, spreadDiscount, sumLines } from "./totals";
import {
  type CreateManualOrderInput,
  type CreateManualOrderResult,
  ORDER_EXPIRY_DAYS,
  isProjectLine,
  taxRateBpsFor,
  toSplitSnapshot,
} from "./types";
import { buildTaxSnapshot } from "./service";

export async function createManualOrder(
  svc: OrdersModule,
  ctx: RequestContext,
  input: CreateManualOrderInput,
  outerTx?: TxCtx,
): Promise<CreateManualOrderResult> {
  const { deps } = svc;
  const now = deps.now ?? (() => new Date());
  return withTx(async (tx) => {
    const settings = await deps.settings.load(tx);
    if (!settings.enabledCurrencies.includes(input.currency)) {
      throw new AppError(ErrorCode.VALIDATION, undefined, { fieldErrors: { currency: ["currency not enabled"] } });
    }
    const currency = input.currency;

    // Customer: an account for product orders; client details are enough for project orders.
    const userId = "userId" in input.customer ? input.customer.userId : null;
    if (input.type === "product" && userId === null) {
      throw new AppError(ErrorCode.VALIDATION, undefined, { fieldErrors: { customer: ["product orders need a customer account"] } });
    }
    if (userId !== null) {
      const [user] = await tx.select({ id: users.id, status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
      if (user === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Customer not found.");
      if (user.status !== "active") throw new AppError(ErrorCode.STATE_INVALID, "Customer account is not active.");
    }
    const client = "clientName" in input.customer
      ? { name: input.customer.clientName, email: input.customer.clientEmail, company: input.customer.clientCompany ?? null }
      : undefined;

    const taxRateBps = taxRateBpsFor({
      productTaxEnabled: input.taxEnabled,
      gstin: settings.gstin,
      settingsTaxRateBps: settings.taxRateBps,
    });

    // Price every line (gross first, then spread the order-level discount, then tax per line).
    const drafts: { line: Omit<OrderLineInsert, "discountMinor" | "taxMinor" | "totalMinor">; gross: number }[] = [];
    for (const item of input.items) {
      if (isProjectLine(item)) {
        drafts.push({
          line: {
            description: item.description,
            unitMinor: item.unitMinor,
            quantity: item.quantity,
            offeringId: null,
            productId: null,
            ownershipId: null,
            splitSnapshot: toSplitSnapshot(item.splitSnapshot),
          },
          gross: item.unitMinor * item.quantity,
        });
        continue;
      }
      const offeringCtx = await svc.loadOfferingContext(item.offeringId, tx);
      if (offeringCtx.offering.status !== "active") throw new AppError(ErrorCode.STATE_INVALID, "Offering is not active.");
      if (offeringCtx.offering.purchaseModel === "custom_quote") {
        throw new AppError(ErrorCode.STATE_INVALID, "Custom-quote offerings are sold through quotes.");
      }
      const price = offeringCtx.prices.find((p) => p.currency === currency);
      if (price === undefined) throw new AppError(ErrorCode.STATE_INVALID, `Offering has no ${currency} price.`);
      if (userId !== null && offeringCtx.offering.purchaseModel === "one_time") {
        // BR-10 via the helper table (same rule as checkout)
        const [owned] = await tx
          .select({ id: userOfferingPurchases.id })
          .from(userOfferingPurchases)
          .where(and(eq(userOfferingPurchases.userId, userId), eq(userOfferingPurchases.offeringId, offeringCtx.offering.id)))
          .limit(1);
        if (owned !== undefined) throw new AppError(ErrorCode.DUPLICATE_PURCHASE);
      }
      drafts.push({
        line: {
          description: `${offeringCtx.product.name} — ${offeringCtx.offering.name}`,
          unitMinor: price.amountMinor,
          quantity: 1,
          offeringId: offeringCtx.offering.id,
          productId: offeringCtx.product.id,
          ownershipId: await activeOwnershipId(offeringCtx.product.id, tx),
          splitSnapshot: null,
        },
        gross: price.amountMinor,
      });
    }
    const discounts = spreadDiscount(input.discountMinor ?? 0, drafts.map((d) => d.gross));
    const lines: OrderLineInsert[] = drafts.map((d, i) => ({
      ...d.line,
      ...computeLine({ ...d.line, discountMinor: discounts[i] ?? 0 }, taxRateBps, currency),
    }));
    const totals = sumLines(lines, currency);

    const { order, items } = await svc.insertOrder(
      {
        type: input.type,
        userId,
        client,
        currency,
        lines,
        totals,
        couponId: null,
        customQuoteId: null,
        billing: input.billing,
        taxRateBps,
        taxSnapshot: buildTaxSnapshot({ rateBps: taxRateBps, gstin: settings.gstin, billing: input.billing }),
        // Project orders wait for the split approval; they do not expire (BR-10 is a checkout rule).
        expiresAt: input.type === "product" ? addDays(now(), ORDER_EXPIRY_DAYS) : null,
        createdBy: ctx.userId,
      },
      tx,
    );
    if (userId !== null) await svc.upsertBillingProfile(userId, input.billing, tx);

    const result: CreateManualOrderResult = { orderId: order.id, orderNo: order.orderNo };

    if (input.type === "project") {
      const { approvalRequestId } = await deps.approvals.request(
        "project_order.split",
        { type: "order", id: order.id },
        { orderId: order.id },
        ctx.userId,
        tx,
      );
      result.approvalRequestId = approvalRequestId;
    } else if (input.payment !== undefined) {
      const { paymentId } = await deps.payments.createIntentForOrder(order.id, input.payment.method, tx);
      const confirmed = await deps.payments.confirmPayment(
        ctx,
        {
          paymentId,
          amountReceivedMinor: input.payment.amountReceivedMinor,
          reference: input.payment.reference,
          receivedOn: input.payment.paidOn,
          overrideExpiry: false,
        },
        tx,
      );
      result.paymentId = confirmed.payment.id;
      const [invoice] = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.orderId, order.id)).limit(1);
      if (invoice !== undefined) result.invoiceId = invoice.id;
    }

    await deps.audit.log(
      ctx,
      "API-COM-07 order.manual_create",
      { type: "order", id: order.id },
      null,
      {
        orderNo: order.orderNo,
        type: order.type,
        totalMinor: order.totalMinor,
        currency: order.currency,
        items: items.map((i) => ({ id: i.id, description: i.description, totalMinor: i.totalMinor })),
        notes: input.notes ?? null,
        approvalRequestId: result.approvalRequestId ?? null,
        paymentId: result.paymentId ?? null,
      },
      tx,
    );
    return result;
  }, outerTx, deps.db);
}
