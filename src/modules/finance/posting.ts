/**
 * Pure posting planners (docs/06 §4.2, §5.1 step 5, §5.2 step 3; FR-FIN-01..03, FR-FIN-05).
 *
 * A planner turns already-resolved inputs (order items with their split, the confirmed payment's
 * shortfall/fee, the FX rate) into the exact ledger rows and allocation rows to insert. The service
 * (`service.ts`) does the loading and inserting; everything that can be wrong about money is here
 * and therefore unit- and property-tested without a database (FI-01, FI-02, FI-04, FI-11, FI-12).
 */
import { type Currency, toInrMinor } from "@/lib/money";
import type { AllocationLine, EntryType, PartyType } from "../../../drizzle/schema/finance";
import {
  type ItemPosting,
  type ItemReversed,
  computeAllocation,
  reverseItem,
  spreadDeduction,
  splitExpense,
} from "./allocation";

/** One ledger row to insert, before ids/timestamps. */
export interface PlannedEntry {
  entryType: EntryType;
  partyType: PartyType;
  partnerId: string | null;
  amountMinor: number;
  currency: Currency;
  fxRateToInr: string;
  amountInrMinor: number;
  memo: string | null;
  orderId: string | null;
  orderItemId: string | null;
  paymentId: string | null;
  refundId: string | null;
  payoutId: string | null;
  expenseId: string | null;
  approvalRequestId: string | null;
}

export interface PlannedAllocation {
  orderItemId: string;
  ownershipId: string | null;
  companyCutBps: number;
  distributableMinor: number;
  companyMinor: number;
  lines: AllocationLine[];
  currency: Currency;
  amountInrMinor: number;
}

interface EntryLinks {
  orderId?: string | null;
  orderItemId?: string | null;
  paymentId?: string | null;
  refundId?: string | null;
  payoutId?: string | null;
  expenseId?: string | null;
  approvalRequestId?: string | null;
}

/** Build a `PlannedEntry` with the INR equivalent (D-515) and null links unless given. */
export function plannedEntry(
  entryType: EntryType,
  partyType: PartyType,
  partnerId: string | null,
  amountMinor: number,
  currency: Currency,
  fxRateToInr: string,
  memo: string | null,
  links: EntryLinks = {},
): PlannedEntry {
  return {
    entryType,
    partyType,
    partnerId,
    amountMinor,
    currency,
    fxRateToInr,
    amountInrMinor: toInrMinor(amountMinor, fxRateToInr),
    memo,
    orderId: links.orderId ?? null,
    orderItemId: links.orderItemId ?? null,
    paymentId: links.paymentId ?? null,
    refundId: links.refundId ?? null,
    payoutId: links.payoutId ?? null,
    expenseId: links.expenseId ?? null,
    approvalRequestId: links.approvalRequestId ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// postOrderPaid plan
// ---------------------------------------------------------------------------------------------

export interface OrderPostingItem {
  orderItemId: string;
  description: string;
  /** unit × quantity (the `sale` amount, docs/04 §7.2 "sale (gross)"). */
  grossMinor: number;
  discountMinor: number;
  taxMinor: number;
  /** unit × quantity − discount + tax (weights the pro-rata spread of order-level deductions). */
  totalMinor: number;
  /** Product lines: the ownership version used; project lines: null. */
  ownershipId: string | null;
  companyCutBps: number;
  lines: readonly { partnerId: string; shareBps: number }[];
}

export interface OrderPostingInput {
  orderId: string;
  paymentId: string;
  currency: Currency;
  fxRateToInr: string;
  gatewayFeeMinor: number;
  bankShortfallMinor: number;
  items: readonly OrderPostingItem[];
}

export interface OrderPostingPlan {
  entries: PlannedEntry[];
  allocations: PlannedAllocation[];
}

/**
 * Per item: `sale`, `discount`, `tax_collected`, `gateway_fee`, `bank_charge`, `company_cut`,
 * `partner_allocation` × n and one allocation row. Order-level fee and shortfall are spread
 * across items pro-rata by item total (largest remainder), so their sums are exact.
 */
export function planOrderPosting(input: OrderPostingInput): OrderPostingPlan {
  if (input.items.length === 0) throw new RangeError("an order needs at least one item");
  const totals = input.items.map((i) => i.totalMinor);
  const fees = spreadDeduction(input.gatewayFeeMinor, totals);
  const shortfalls = spreadDeduction(input.bankShortfallMinor, totals);
  const entries: PlannedEntry[] = [];
  const allocations: PlannedAllocation[] = [];

  input.items.forEach((item, idx) => {
    const feeMinor = fees[idx] as number;
    const shortfallMinor = shortfalls[idx] as number;
    const alloc = computeAllocation({
      currency: input.currency,
      grossMinor: item.grossMinor,
      discountMinor: item.discountMinor,
      taxMinor: item.taxMinor,
      gatewayFeeMinor: feeMinor,
      bankShortfallMinor: shortfallMinor,
      companyCutBps: item.companyCutBps,
      lines: item.lines.map((l) => ({ partnerId: l.partnerId, shareBps: l.shareBps })),
    });
    const links: EntryLinks = {
      orderId: input.orderId,
      orderItemId: item.orderItemId,
      paymentId: input.paymentId,
    };
    const e = (
      type: EntryType,
      party: PartyType,
      amount: number,
      memo: string,
      partnerId: string | null = null,
    ) =>
      entries.push(
        plannedEntry(type, party, partnerId, amount, input.currency, input.fxRateToInr, memo, links),
      );

    e("sale", "customer", item.grossMinor, `Sale: ${item.description}`);
    e("discount", "customer", -item.discountMinor, `Discount: ${item.description}`);
    e("tax_collected", "tax_authority", item.taxMinor, `Tax collected: ${item.description}`);
    e("gateway_fee", "gateway", -feeMinor, `Gateway fee: ${item.description}`);
    e("bank_charge", "bank", -shortfallMinor, `Bank shortfall: ${item.description}`);
    e("company_cut", "company", alloc.companyMinor, `Company cut: ${item.description}`);
    for (const line of alloc.lines) {
      e(
        "partner_allocation",
        "partner",
        line.amount_minor,
        `Partner allocation (${String(line.share_bps)} bps): ${item.description}`,
        line.partner_id,
      );
    }
    allocations.push({
      orderItemId: item.orderItemId,
      ownershipId: item.ownershipId,
      companyCutBps: item.companyCutBps,
      distributableMinor: alloc.distributableMinor,
      companyMinor: alloc.companyMinor,
      lines: alloc.lines,
      currency: input.currency,
      amountInrMinor: toInrMinor(alloc.distributableMinor, input.fxRateToInr),
    });
  });

  return { entries, allocations };
}

// ---------------------------------------------------------------------------------------------
// postRefund plan
// ---------------------------------------------------------------------------------------------

export interface RefundPostingInput {
  orderId: string;
  refundId: string;
  currency: Currency;
  fxRateToInr: string;
  /** Refunds executed earlier on this order (posted), in minor units. */
  previouslyRefundedMinor: number;
  /** This refund's amount. */
  refundMinor: number;
  items: readonly (ItemPosting & { description: string; already: ItemReversed })[];
}

/**
 * The cumulative refunded amount (previous + this) is spread across items pro-rata by item
 * total, each item's cumulative reversal target is derived from its original posting, and only
 * the delta over what was already reversed is posted (see `reverseItem`). Gateway fees and bank
 * charges are never reversed (MASTER_SPEC §7 "Refund reversal scope").
 */
export function planRefundPosting(input: RefundPostingInput): PlannedEntry[] {
  if (input.items.length === 0) throw new RangeError("an order needs at least one item");
  if (input.refundMinor < 0) throw new RangeError("refund must be ≥ 0");
  const totals = input.items.map((i) => i.totalMinor);
  const orderTotal = totals.reduce((a, b) => a + b, 0);
  const cumulative = input.previouslyRefundedMinor + input.refundMinor;
  if (cumulative > orderTotal) throw new RangeError("cumulative refunds exceed the order total");
  const cumulativePerItem = spreadDeduction(cumulative, totals);

  const entries: PlannedEntry[] = [];
  input.items.forEach((item, idx) => {
    const rev = reverseItem(item, cumulativePerItem[idx] as number, item.already);
    const links: EntryLinks = {
      orderId: input.orderId,
      orderItemId: item.orderItemId,
      refundId: input.refundId,
    };
    const e = (
      type: EntryType,
      party: PartyType,
      amount: number,
      memo: string,
      partnerId: string | null = null,
    ) =>
      entries.push(
        plannedEntry(type, party, partnerId, amount, input.currency, input.fxRateToInr, memo, links),
      );
    e("refund_sale", "customer", rev.refundSaleMinor, `Refund of sale: ${item.description}`);
    e(
      "refund_discount",
      "customer",
      rev.refundDiscountMinor,
      `Refund of discount: ${item.description}`,
    );
    e("refund_tax", "tax_authority", rev.refundTaxMinor, `Refund of tax: ${item.description}`);
    e(
      "refund_company_cut",
      "company",
      rev.refundCompanyMinor,
      `Refund of company cut: ${item.description}`,
    );
    for (const line of rev.refundLines) {
      e(
        "refund_partner_allocation",
        "partner",
        line.amount_minor,
        `Refund of partner allocation: ${item.description}`,
        line.partner_id,
      );
    }
  });
  return entries;
}

// ---------------------------------------------------------------------------------------------
// postExpense plan
// ---------------------------------------------------------------------------------------------

export interface ExpensePostingInput {
  expenseId: string;
  currency: Currency;
  fxRateToInr: string;
  amountMinor: number;
  category: string;
  /** Null → single company line. */
  split: { companyCutBps: number; lines: readonly { partnerId: string; shareBps: number }[] } | null;
}

/** One company line, or the company cut plus one negative line per partner (D-514). */
export function planExpensePosting(input: ExpensePostingInput): PlannedEntry[] {
  const links: EntryLinks = { expenseId: input.expenseId };
  const memo = `Expense: ${input.category}`;
  if (input.split === null || input.split.lines.length === 0) {
    return [
      plannedEntry(
        "expense",
        "company",
        null,
        -input.amountMinor,
        input.currency,
        input.fxRateToInr,
        memo,
        links,
      ),
    ];
  }
  const split = splitExpense(
    input.amountMinor,
    input.currency,
    input.split.companyCutBps,
    input.split.lines,
  );
  const entries: PlannedEntry[] = [
    plannedEntry(
      "expense",
      "company",
      null,
      split.companyMinor,
      input.currency,
      input.fxRateToInr,
      memo,
      links,
    ),
  ];
  for (const line of split.lines) {
    entries.push(
      plannedEntry(
        "expense",
        "partner",
        line.partner_id,
        line.amount_minor,
        input.currency,
        input.fxRateToInr,
        `${memo} (${String(line.share_bps)} bps)`,
        links,
      ),
    );
  }
  return entries;
}
