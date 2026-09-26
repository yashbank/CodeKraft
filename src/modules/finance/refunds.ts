/**
 * Finance refund posting implementation (FI-04, FI-05, MASTER_SPEC §7 "Refund reversal scope").
 *
 * Implements proportional reversal of sale, discount, tax, company cut, and partner allocations.
 * Gateway fees and bank charges are never reversed.
 * Full refund nets to zero for the order.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { allocateLargestRemainder } from "@/lib/money";
import { type Currency } from "@/lib/money";
import {
  type EntryType,
  type NewLedgerEntry,
  type PartyType,
  allocations,
  ledgerEntries,
} from "../../../drizzle/schema/finance";
import { orderItems, orders, refunds } from "../../../drizzle/schema/commerce";
import { AppError, ErrorCode } from "@/lib/errors";
import { spreadDeduction } from "./allocation";
import type { PostEntriesResult } from "./types";

export interface ComputeItemRefundPlanInput {
  orderId: string;
  orderItemId: string;
  paymentId: string;
  refundId: string;
  currency: Currency;
  fxRateToInr: string;
  createdBy: string;
  createdAt: Date;
  grossMinor: number;
  discountMinor: number;
  taxMinor: number;
  companyMinor: number;
  partnerLines: { partnerId: string; amountMinor: number }[];
  itemRefundAmountMinor: number;
  itemTotalMinor: number;
  memoPrefix?: string;
}

export function computeItemRefundPlan(input: ComputeItemRefundPlanInput): NewLedgerEntry[] {
  const {
    orderId,
    orderItemId,
    paymentId,
    refundId,
    currency,
    fxRateToInr,
    createdBy,
    createdAt,
    grossMinor,
    discountMinor,
    taxMinor,
    companyMinor,
    partnerLines,
    itemRefundAmountMinor,
    itemTotalMinor,
    memoPrefix,
  } = input;

  if (itemRefundAmountMinor <= 0) {
    return [];
  }

  const rate = Number(fxRateToInr);
  const toInr = (amount: number) =>
    currency === "INR" ? amount : Math.round(amount * rate);

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
      orderId,
      orderItemId,
      paymentId,
      refundId,
      partyType,
      partnerId,
      amountMinor,
      currency,
      fxRateToInr,
      amountInrMinor: toInr(amountMinor),
      memo: memo ?? null,
      createdBy,
      createdAt,
    });
  };

  const isFullRefund = itemRefundAmountMinor === itemTotalMinor;

  let refundGross: number;
  let refundDiscount: number;
  let refundTax: number;
  let refundCompany: number;
  let refundPartners: number[];

  if (isFullRefund) {
    refundGross = grossMinor;
    refundDiscount = discountMinor;
    refundTax = taxMinor;
    refundPartners = partnerLines.map((p) => p.amountMinor);
    const partnersTotal = refundPartners.reduce((acc, p) => acc + p, 0);
    refundCompany = refundGross - refundDiscount - refundTax - partnersTotal;
  } else {
    // Proportional fraction f = refundAmount / total
    const f = itemRefundAmountMinor / itemTotalMinor;

    refundDiscount = Math.round(f * discountMinor);
    refundTax = Math.round(f * taxMinor);

    // Balance refundGross so that customer net refund (gross - discount + tax) matches itemRefundAmountMinor
    refundGross = itemRefundAmountMinor + refundDiscount - refundTax;

    // Distributable revenue portion to be reversed from company and partners
    const netRevenueRefund = refundGross - refundDiscount - refundTax;

    const partnerAmounts = partnerLines.map((p) => p.amountMinor);
    const sharesToSplit = [companyMinor, ...partnerAmounts];

    const allocatedReversals = allocateLargestRemainder(netRevenueRefund, sharesToSplit);
    refundCompany = allocatedReversals[0] ?? 0;
    refundPartners = allocatedReversals.slice(1);
  }

  // 1. Refund Sale (+ credit to customer account)
  addEntry(
    "refund_sale",
    "customer",
    refundGross,
    null,
    memoPrefix ? `${memoPrefix} · Refund sale` : "Refund sale",
  );

  // 2. Refund Discount (- debit to customer account, reversing discount credit)
  if (refundDiscount > 0) {
    addEntry("refund_discount", "customer", -refundDiscount, null, "Refund discount");
  }

  // 3. Refund Tax (- debit to tax authority, reversing tax collected)
  if (refundTax > 0) {
    addEntry("refund_tax", "tax_authority", -refundTax, null, "Refund tax");
  }

  // 4. Refund Company Cut (- debit to company)
  addEntry("refund_company_cut", "company", -refundCompany, null, "Refund company cut");

  // 5. Refund Partner Allocation (- debit to each partner)
  for (let i = 0; i < partnerLines.length; i++) {
    const pLine = partnerLines[i]!;
    const pRefund = refundPartners[i] ?? 0;
    addEntry(
      "refund_partner_allocation",
      "partner",
      -pRefund,
      pLine.partnerId,
      "Refund partner allocation",
    );
  }

  return entries;
}

export async function postRefund(refundId: string, tx: TxCtx): Promise<PostEntriesResult> {
  // 1. Load refund
  const [refund] = await tx
    .select()
    .from(refunds)
    .where(eq(refunds.id, refundId))
    .limit(1);

  if (!refund) {
    throw new AppError(ErrorCode.NOT_FOUND, "Refund not found");
  }

  // 2. Load order
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, refund.orderId))
    .limit(1);

  if (!order) {
    throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
  }

  // 3. Load order items and allocations
  const items = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(orderItems.createdAt);

  if (items.length === 0) {
    throw new AppError(ErrorCode.STATE_INVALID, "Order has no items");
  }

  const itemAllocations = await tx
    .select()
    .from(allocations)
    .where(inArray(allocations.orderItemId, items.map((i) => i.id)));

  const allocationByItemId = new Map(itemAllocations.map((a) => [a.orderItemId, a]));

  // 4. Spread refund across items pro-rata by item total
  const itemTotals = items.map((i) => i.totalMinor);
  const refundPerItem = spreadDeduction(refund.amountMinor, itemTotals);

  const allEntriesToInsert: NewLedgerEntry[] = [];
  const now = refund.executedAt ?? new Date();

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]!;
    const itemRefundMinor = refundPerItem[idx] ?? 0;
    if (itemRefundMinor <= 0) continue;

    const alloc = allocationByItemId.get(item.id);
    const companyMinor = alloc?.companyMinor ?? 0;
    const partnerLines =
      alloc?.lines.map((l) => ({
        partnerId: l.partner_id,
        amountMinor: l.amount_minor,
      })) ?? [];

    const itemEntries = computeItemRefundPlan({
      orderId: order.id,
      orderItemId: item.id,
      paymentId: refund.paymentId,
      refundId: refund.id,
      currency: order.currency as Currency,
      fxRateToInr: String(order.fxRateToInr),
      createdBy: refund.executedBy ?? order.createdBy ?? order.userId!,
      createdAt: now,
      grossMinor: item.unitMinor * item.quantity,
      discountMinor: item.discountMinor,
      taxMinor: item.taxMinor,
      companyMinor,
      partnerLines,
      itemRefundAmountMinor: itemRefundMinor,
      itemTotalMinor: item.totalMinor,
      memoPrefix: item.description,
    });

    allEntriesToInsert.push(...itemEntries);
  }

  const inserted = await tx
    .insert(ledgerEntries)
    .values(allEntriesToInsert)
    .returning({ id: ledgerEntries.id });

  return {
    entryIds: inserted.map((e) => e.id),
    entryCount: inserted.length,
  };
}
