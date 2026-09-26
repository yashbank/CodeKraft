/**
 * Ledger posting for paid orders (docs/06 §4.2, §5.1 step 5, master plan §5, FI-01..04, FI-10..12).
 *
 * Appends immutable ledger entries and allocation snapshots in the caller's transaction.
 */
import { and, eq } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { type Currency } from "@/lib/money";
import { fxService } from "@/modules/fx/service";
import { ownershipService } from "@/modules/ownership/service";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { orderItems, orders, payments } from "../../../drizzle/schema/commerce";
import {
  type AllocationLine,
  type EntryType,
  type NewAllocation,
  type NewLedgerEntry,
  type PartyType,
  allocations,
  ledgerEntries,
} from "../../../drizzle/schema/finance";
import { computeAllocation, spreadDeduction } from "./allocation";
import type { PostOrderPaidResult } from "./types";

export interface ItemPostingPlanInput {
  orderId: string;
  orderItemId: string;
  paymentId: string;
  currency: Currency;
  grossMinor: number;
  discountMinor: number;
  taxMinor: number;
  gatewayFeeMinor: number;
  bankShortfallMinor: number;
  companyCutBps: number;
  lines: { partnerId: string; shareBps: number }[];
  ownershipId: string | null;
  fxRateToInr: string;
  createdBy: string;
  createdAt: Date;
  memoPrefix?: string;
}

export interface ItemPostingPlan {
  allocation: NewAllocation;
  entries: NewLedgerEntry[];
}

/**
 * Pure builder for an item's posting plan (entries + allocation snapshot).
 * Enforces FI-01, FI-02, FI-04, and FI-11.
 */
export function buildItemPostingPlan(input: ItemPostingPlanInput): ItemPostingPlan {
  const allocation = computeAllocation({
    currency: input.currency,
    grossMinor: input.grossMinor,
    discountMinor: input.discountMinor,
    taxMinor: input.taxMinor,
    gatewayFeeMinor: input.gatewayFeeMinor,
    bankShortfallMinor: input.bankShortfallMinor,
    companyCutBps: input.companyCutBps,
    lines: input.lines,
  });

  const rate = Number(input.fxRateToInr);
  const toInr = (amount: number) =>
    input.currency === "INR" ? amount : Math.round(amount * rate);

  const allocationRow: NewAllocation = {
    orderItemId: input.orderItemId,
    ownershipId: input.ownershipId,
    companyCutBps: input.companyCutBps,
    distributableMinor: allocation.distributableMinor,
    companyMinor: allocation.companyMinor,
    lines: allocation.lines.map((l) => ({
      partner_id: l.partner_id,
      share_bps: l.share_bps,
      amount_minor: l.amount_minor,
    })),
    currency: input.currency,
    amountInrMinor: toInr(allocation.distributableMinor),
    createdAt: input.createdAt,
  };

  const entries: NewLedgerEntry[] = [];

  const addEntry = (
    entryType: EntryType,
    partyType: PartyType,
    amountMinor: number,
    partnerId: string | null = null,
    memo?: string,
  ) => {
    entries.push({
      entryType,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      paymentId: input.paymentId,
      partyType,
      partnerId,
      amountMinor,
      currency: input.currency,
      fxRateToInr: input.fxRateToInr,
      amountInrMinor: toInr(amountMinor),
      memo: memo ?? null,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
    });
  };

  // 1. Sale (gross customer debit: negative from perspective of customer account)
  addEntry(
    "sale",
    "customer",
    -input.grossMinor,
    null,
    input.memoPrefix ? `${input.memoPrefix} · Sale` : "Sale",
  );

  // 2. Discount (reduces customer debit, positive credit back to customer)
  if (input.discountMinor > 0) {
    addEntry("discount", "customer", input.discountMinor, null, "Discount");
  }

  // 3. Tax collected (credit to tax authority)
  if (input.taxMinor > 0) {
    addEntry("tax_collected", "tax_authority", input.taxMinor, null, "Tax collected");
  }

  // 4. Gateway fee (credit to gateway)
  if (input.gatewayFeeMinor > 0) {
    addEntry("gateway_fee", "gateway", input.gatewayFeeMinor, null, "Gateway fee");
  }

  // 5. Bank charge / shortfall (credit to bank)
  if (input.bankShortfallMinor > 0) {
    addEntry("bank_charge", "bank", input.bankShortfallMinor, null, "Bank shortfall");
  }

  // 6. Company cut (credit to company, always written even if 0 per spec)
  addEntry("company_cut", "company", allocation.companyMinor, null, "Company cut");

  // 7. Partner allocations (credit to each partner)
  for (const line of allocation.lines) {
    addEntry(
      "partner_allocation",
      "partner",
      line.amount_minor,
      line.partner_id,
      "Partner allocation",
    );
  }

  return {
    allocation: allocationRow,
    entries,
  };
}

/**
 * Post a confirmed paid order (docs/06 §4.2, §5.1 step 5, master plan §5).
 */
export async function postOrderPaid(orderId: string, tx: TxCtx): Promise<PostOrderPaidResult> {
  // 1. Load order
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
  }

  // 2. Load confirmed payment
  const [payment] = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "confirmed")))
    .limit(1);

  if (!payment) {
    throw new AppError(ErrorCode.STATE_INVALID, "No confirmed payment found for order");
  }

  // 3. Load order items
  const items = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.createdAt);

  if (items.length === 0) {
    throw new AppError(ErrorCode.STATE_INVALID, "Order has no items");
  }

  const paidAt = order.paidAt ?? payment.confirmedAt ?? new Date();
  const createdBy = payment.confirmedBy ?? order.createdBy;
  if (!createdBy) {
    throw new AppError(ErrorCode.STATE_INVALID, "No user identified for posting created_by");
  }

  // 4. Spread shortfall and gateway fee pro-rata across items
  const itemTotals = items.map((i) => i.totalMinor);
  const bankShortfallTotal = payment.bankShortfallMinor ?? 0;
  const shortfallSpread = spreadDeduction(bankShortfallTotal, itemTotals);

  // Gateway fee: 0 for manual providers, or from provider payload if gateway
  const gatewayFeeTotal =
    typeof payment.providerPayload?.gatewayFeeMinor === "number"
      ? (payment.providerPayload.gatewayFeeMinor as number)
      : 0;
  const feeSpread = spreadDeduction(gatewayFeeTotal, itemTotals);

  // 5. Rate to INR
  const fxRateToInr =
    order.currency === "INR"
      ? "1.00000000"
      : await fxService.rateToInrOn(order.currency as Currency, paidAt, tx);

  const allEntriesToInsert: NewLedgerEntry[] = [];
  const allAllocationsToInsert: NewAllocation[] = [];

  // 6. Process each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const itemShortfall = shortfallSpread[i] ?? 0;
    const itemFee = feeSpread[i] ?? 0;
    const grossMinor = item.unitMinor * item.quantity;

    let companyCutBps: number;
    let lines: { partnerId: string; shareBps: number }[];
    let targetOwnershipId: string | null = null;

    if (item.productId) {
      // Product line: resolve ownership active at paid_at
      const activeOwnership = await ownershipService.getActiveAt(item.productId, paidAt, tx);
      if (!activeOwnership) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `No active ownership found for product ${item.productId} at paid time`,
        );
      }
      companyCutBps = activeOwnership.companyCutBps;
      lines = activeOwnership.lines.map((l) => ({
        partnerId: l.partnerId,
        shareBps: l.shareBps,
      }));
      targetOwnershipId = activeOwnership.id;

      // Update order_items.ownership_id if superseded meanwhile (only permitted update)
      if (item.ownershipId !== activeOwnership.id) {
        await tx
          .update(orderItems)
          .set({ ownershipId: activeOwnership.id })
          .where(eq(orderItems.id, item.id));
      }
    } else {
      // Project line: verify split_approval_request_id points to an applied project_order.split
      if (!order.splitApprovalRequestId) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Project order items require split approval request ID",
        );
      }

      const [approval] = await tx
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, order.splitApprovalRequestId))
        .limit(1);

      if (!approval || approval.type !== "project_order.split" || approval.status !== "applied") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Project order split approval must be applied",
        );
      }

      if (!item.splitSnapshot) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Project item is missing split snapshot",
        );
      }

      companyCutBps = item.splitSnapshot.company_cut_bps;
      lines = item.splitSnapshot.lines.map((l) => ({
        partnerId: l.partner_id,
        shareBps: l.share_bps,
      }));
      targetOwnershipId = null;
    }

    const plan = buildItemPostingPlan({
      orderId: order.id,
      orderItemId: item.id,
      paymentId: payment.id,
      currency: order.currency as Currency,
      grossMinor,
      discountMinor: item.discountMinor,
      taxMinor: item.taxMinor,
      gatewayFeeMinor: itemFee,
      bankShortfallMinor: itemShortfall,
      companyCutBps,
      lines,
      ownershipId: targetOwnershipId,
      fxRateToInr,
      createdBy,
      createdAt: paidAt,
      memoPrefix: item.description,
    });

    allAllocationsToInsert.push(plan.allocation);
    allEntriesToInsert.push(...plan.entries);
  }

  // 7. Insert allocations and entries
  const insertedAllocations = await tx
    .insert(allocations)
    .values(allAllocationsToInsert)
    .returning({ id: allocations.id });

  const insertedEntries = await tx
    .insert(ledgerEntries)
    .values(allEntriesToInsert)
    .returning({ id: ledgerEntries.id });

  return {
    entryIds: insertedEntries.map((e) => e.id),
    allocationIds: insertedAllocations.map((a) => a.id),
    entryCount: insertedEntries.length,
  };
}
