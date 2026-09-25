/**
 * Pure allocation math (docs/06 §4.2, FR-FIN-02, MASTER_SPEC §7 "Split rounding"; P4.1, P4.8).
 *
 * Nothing here touches the database. Every rounding goes through `@/lib/money`
 * (`mulBps`, `allocateLargestRemainder`, `divRoundHalfUp`) — this file is under the
 * `no-float-money` lint rule and must never divide with `/`.
 *
 * Sign convention of the ledger (drizzle/schema/finance.ts header, diagrams/revenue-flow.md §2):
 *   sale +gross (customer) · discount −discount (customer) · tax_collected +tax (tax_authority)
 *   gateway_fee −fee (gateway) · bank_charge −shortfall (bank) · company_cut +company (company)
 *   partner_allocation +line (partner). Refunds post the exact opposite sign per type; payouts and
 *   expenses are negative against the party they reduce.
 *
 * FI-04 ("Σ entries per order across all party types = 0, customer debit = company + partners +
 * tax + bank + gateway credits") is therefore the party-level identity
 *   Σ customer + Σ gateway + Σ bank − Σ tax_authority − Σ company − Σ partner = 0
 * over a payment posting group (`partyImbalance` computes the left-hand side).
 */
import {
  type Currency,
  allocateLargestRemainder,
  divRoundHalfUp,
  mulBps,
  toSafeNumber,
} from "@/lib/money";
import type { AllocationLine, EntryType, PartyType } from "../../../drizzle/schema/finance";
import {
  type AllocationResult,
  type ComputeAllocation,
  type ComputeAllocationInput,
  type SpreadDeduction,
  computeAllocationInput,
} from "./types";

// ---------------------------------------------------------------------------------------------
// §4.2 computeAllocation — identical in behaviour to `computeAllocationReference`
// ---------------------------------------------------------------------------------------------

/**
 * distributable = gross − discount − tax − gatewayFee − bankShortfall;
 * company = distributable × companyCutBps / 10000 (half-up);
 * partner lines = largest-remainder shares of (distributable − company), ties → larger share,
 * then earliest line. Σ lines + company = distributable exactly.
 */
export const computeAllocation: ComputeAllocation = (raw: ComputeAllocationInput) => {
  const input = computeAllocationInput.parse(raw);
  const distributableMinor =
    input.grossMinor -
    input.discountMinor -
    input.taxMinor -
    input.gatewayFeeMinor -
    input.bankShortfallMinor;
  const companyMinor = mulBps(
    { amountMinor: distributableMinor, currency: input.currency },
    input.companyCutBps,
  ).amountMinor;
  const parts = allocateLargestRemainder(
    distributableMinor - companyMinor,
    input.lines.map((l) => l.shareBps),
  );
  const lines: AllocationLine[] = input.lines.map((l, i) => ({
    partner_id: l.partnerId,
    share_bps: l.shareBps,
    amount_minor: parts[i] as number,
  }));
  const result: AllocationResult = {
    currency: input.currency,
    distributableMinor,
    companyMinor,
    lines,
  };
  return result;
};

/** Pro-rata spread of an order-level deduction across items by item total (largest remainder). */
export const spreadDeduction: SpreadDeduction = (totalMinor, itemTotalsMinor) => {
  if (itemTotalsMinor.length === 0) throw new RangeError("at least one item is required");
  if (itemTotalsMinor.every((t) => t === 0)) {
    return itemTotalsMinor.map((_, i) => (i === 0 ? totalMinor : 0));
  }
  return allocateLargestRemainder(totalMinor, itemTotalsMinor);
};

// ---------------------------------------------------------------------------------------------
// Proportional scaling (refunds): `amount × part / whole`, half-up, integer only
// ---------------------------------------------------------------------------------------------

/** `amount × numerator / denominator` rounded half away from zero; 0 when the denominator is 0. */
export function scaleMinor(amountMinor: number, numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return toSafeNumber(
    divRoundHalfUp(BigInt(amountMinor) * BigInt(numerator), BigInt(denominator)),
    "scaled amount",
  );
}

// ---------------------------------------------------------------------------------------------
// Refund reversal per item (FR-FIN-05, FI-05, MASTER_SPEC §7 "Refund reversal scope")
// ---------------------------------------------------------------------------------------------

/** The original posting of one item, as magnitudes (what `postOrderPaid` wrote). */
export interface ItemPosting {
  orderItemId: string;
  /** unit × quantity − discount + tax — the base the refund fraction is taken against. */
  totalMinor: number;
  saleMinor: number;
  discountMinor: number;
  taxMinor: number;
  companyMinor: number;
  lines: readonly AllocationLine[];
}

/** Signed magnitudes already reversed on the item by earlier refunds (positive numbers). */
export interface ItemReversed {
  saleMinor: number;
  discountMinor: number;
  taxMinor: number;
  companyMinor: number;
  /** partner_id → reversed magnitude */
  lines: Readonly<Record<string, number>>;
}

export const NO_REVERSAL: ItemReversed = Object.freeze({
  saleMinor: 0,
  discountMinor: 0,
  taxMinor: 0,
  companyMinor: 0,
  lines: Object.freeze({}),
});

/** Signed entry amounts to post for one refund on one item (sale/tax/company/lines ≤ 0, discount ≥ 0). */
export interface ItemReversal {
  orderItemId: string;
  refundSaleMinor: number;
  refundDiscountMinor: number;
  refundTaxMinor: number;
  refundCompanyMinor: number;
  refundLines: { partner_id: string; share_bps: number; amount_minor: number }[];
}

/**
 * Reversal for one item given the *cumulative* refunded amount on it (previous refunds + this
 * one). Each type's cumulative target is `original × cumulativeRefund / total` (half-up); the
 * distribution side (company + partner lines) is first scaled as a whole and then split by the
 * original amounts with largest-remainder rounding, so `refundCompany + Σ refundLines` equals the
 * reversed distributable exactly. What was already reversed is subtracted, hence several partial
 * refunds never overshoot and a cumulative full refund nets every reversible entry to zero.
 */
export function reverseItem(
  posting: ItemPosting,
  cumulativeRefundMinor: number,
  already: ItemReversed = NO_REVERSAL,
): ItemReversal {
  if (cumulativeRefundMinor < 0) throw new RangeError("cumulative refund must be ≥ 0");
  if (cumulativeRefundMinor > posting.totalMinor) {
    throw new RangeError("cumulative refund exceeds the item total");
  }
  const target = (original: number) =>
    scaleMinor(original, cumulativeRefundMinor, posting.totalMinor);

  const saleTarget = target(posting.saleMinor);
  const discountTarget = target(posting.discountMinor);
  const taxTarget = target(posting.taxMinor);

  const lineSum = posting.lines.reduce((acc, l) => acc + l.amount_minor, 0);
  const distributable = posting.companyMinor + lineSum;
  const distTarget = target(distributable);
  const weights = [posting.companyMinor, ...posting.lines.map((l) => l.amount_minor)];
  const parts =
    distTarget === 0 || weights.every((w) => w === 0)
      ? weights.map(() => 0)
      : allocateLargestRemainder(distTarget, weights);
  const companyTarget = parts[0] as number;

  return {
    orderItemId: posting.orderItemId,
    refundSaleMinor: -(saleTarget - already.saleMinor),
    refundDiscountMinor: discountTarget - already.discountMinor,
    refundTaxMinor: -(taxTarget - already.taxMinor),
    refundCompanyMinor: -(companyTarget - already.companyMinor),
    refundLines: posting.lines.map((l, i) => ({
      partner_id: l.partner_id,
      share_bps: l.share_bps,
      amount_minor: -((parts[i + 1] as number) - (already.lines[l.partner_id] ?? 0)),
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Expense split (D-514): company cut first, remainder by share, all negative
// ---------------------------------------------------------------------------------------------

export interface ExpenseSplit {
  companyMinor: number;
  lines: AllocationLine[];
}

/** `−amount` split as an allocation: company cut by bps, remainder by partner shares. */
export function splitExpense(
  amountMinor: number,
  currency: Currency,
  companyCutBps: number,
  lines: readonly { partnerId: string; shareBps: number }[],
): ExpenseSplit {
  const company = mulBps({ amountMinor, currency }, companyCutBps).amountMinor;
  const parts =
    lines.length === 0
      ? []
      : allocateLargestRemainder(
          amountMinor - company,
          lines.map((l) => l.shareBps),
        );
  return {
    companyMinor: -(lines.length === 0 ? amountMinor : company),
    lines: lines.map((l, i) => ({
      partner_id: l.partnerId,
      share_bps: l.shareBps,
      amount_minor: -(parts[i] as number),
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// FI-04 party-level identity
// ---------------------------------------------------------------------------------------------

/** Party types on the "inflow" side of the identity; the rest are the "distribution" side. */
export const INFLOW_PARTIES: readonly PartyType[] = ["customer", "gateway", "bank"];

/** Entry types of a payment posting group (never refunds, payouts, expenses or adjustments). */
export const PAYMENT_GROUP_TYPES: readonly EntryType[] = [
  "sale",
  "discount",
  "tax_collected",
  "gateway_fee",
  "bank_charge",
  "company_cut",
  "partner_allocation",
];

/**
 * `Σ inflow-side − Σ distribution-side` of a set of entries; 0 when FI-04 holds. Only the
 * payment-group types take part (refund groups are checked by `reverseItem`'s invariants).
 */
export function partyImbalance(
  entries: readonly { entryType: EntryType; partyType: PartyType; amountMinor: number }[],
): number {
  let inflow = 0;
  let distribution = 0;
  for (const e of entries) {
    if (!PAYMENT_GROUP_TYPES.includes(e.entryType)) continue;
    if (INFLOW_PARTIES.includes(e.partyType)) inflow += e.amountMinor;
    else distribution += e.amountMinor;
  }
  return inflow - distribution;
}
