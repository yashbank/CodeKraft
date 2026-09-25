/**
 * Finance — Zod input schemas, output types and the pure allocation contract
 * (docs/06 §2.6 API-FIN-01..11, §4.2 posting formula; docs/04 §7.2; MASTER_SPEC §4.1, §4.8,
 * §7 "Split rounding" / "Overpayment" / "Payout > balance" / "Refund reversal scope").
 *
 * This file is under the `no-float-money` lint rule: integer minor units only, rounding through
 * `@/lib/money` (`mulBps`, `allocateLargestRemainder`).
 */
import { z } from "zod";
import { type Currency, type Money, allocateLargestRemainder, mulBps } from "@/lib/money";
import type {
  Allocation,
  AllocationLine,
  EntryType,
  Expense,
  LedgerEntry,
  PartyType,
  Payout,
} from "../../../drizzle/schema/finance";
import {
  bpsSchema as zBps,
  currencySchema as zCurrency,
  isoDateSchema as zIsoDate,
  listParams as zListParams,
  minorUnitsSchema as zMinor,
  positiveMinorUnitsSchema as zPositiveMinor,
  signedMinorUnitsSchema as zSignedMinor,
  trimmedString as zTrimmed,
  uuidSchema as zUuid,
} from "@/modules/_shared/zod";
import { zDateRange, zPublicOrderNo, zSplitLine } from "@/modules/orders/types";

// ---------------------------------------------------------------------------------------------
// Enums mirrored from drizzle/schema/finance (docs/05 §7)
// ---------------------------------------------------------------------------------------------

export const ENTRY_TYPES = [
  "sale",
  "discount",
  "tax_collected",
  "gateway_fee",
  "bank_charge",
  "company_cut",
  "partner_allocation",
  "refund_sale",
  "refund_discount",
  "refund_tax",
  "refund_company_cut",
  "refund_partner_allocation",
  "payout",
  "expense",
  "adjustment",
] as const satisfies readonly EntryType[];

export const PARTY_TYPES = [
  "customer",
  "company",
  "partner",
  "tax_authority",
  "gateway",
  "bank",
] as const satisfies readonly PartyType[];

/** Entry types posted by `postOrderPaid` per item (docs/06 §5.1 step 5). */
export const ORDER_PAID_ENTRY_TYPES = [
  "sale",
  "discount",
  "tax_collected",
  "gateway_fee",
  "bank_charge",
  "company_cut",
  "partner_allocation",
] as const satisfies readonly EntryType[];

/** Reversed proportionally by `postRefund`; `gateway_fee` / `bank_charge` are never reversed. */
export const REFUND_REVERSAL: Readonly<Partial<Record<EntryType, EntryType>>> = Object.freeze({
  sale: "refund_sale",
  discount: "refund_discount",
  tax_collected: "refund_tax",
  company_cut: "refund_company_cut",
  partner_allocation: "refund_partner_allocation",
});

/** API-FIN-09 report keys (D-513); `customer_credits` reads `VIEW customer_credits`. */
export const REPORT_KEYS = [
  "revenue_by_product",
  "revenue_by_partner",
  "revenue_by_period",
  "tax_collected",
  "refunds",
  "outstanding_payouts",
  "profit_by_product",
  "customer_credits",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];
export const REPORT_GRANULARITIES = ["day", "month", "fy"] as const;
export const REPORT_CURRENCY_MODES = ["INR", "native"] as const;
export const STATEMENT_FORMATS = ["pdf", "csv"] as const;
export type StatementFormat = (typeof STATEMENT_FORMATS)[number];

// ---------------------------------------------------------------------------------------------
// API-FIN-01 listLedgerEntries (query) — sort `seq` only
// ---------------------------------------------------------------------------------------------

export const listLedgerEntriesInput = zListParams(
  ["seq"],
  z
    .object({
      entryType: z.array(z.enum(ENTRY_TYPES)).min(1).optional(),
      partnerId: zUuid.optional(),
      productId: zUuid.optional(),
      orderNo: zPublicOrderNo.optional(),
      currency: zCurrency.optional(),
      approvalRequestId: zUuid.optional(),
      ...zDateRange,
    })
    .strict(),
);
export type ListLedgerEntriesInput = z.infer<typeof listLedgerEntriesInput>;

export interface LedgerEntryView {
  entryId: string;
  seq: number;
  entryType: EntryType;
  partyType: PartyType;
  partnerId: string | null;
  amount: Money;
  amountInrMinor: number;
  fxRateToInr: string;
  memo: string | null;
  createdAt: string;
  createdBy: string;
  links: {
    orderId: string | null;
    orderNo: string | null;
    orderItemId: string | null;
    paymentId: string | null;
    refundId: string | null;
    payoutId: string | null;
    expenseId: string | null;
    approvalRequestId: string | null;
  };
}

export interface LedgerListResult {
  items: LedgerEntryView[];
  nextCursor: string | null;
  total?: number;
  totals: { byType: Partial<Record<EntryType, Money>> };
}

// ---------------------------------------------------------------------------------------------
// API-FIN-02 getOrderAllocation (query)
// ---------------------------------------------------------------------------------------------

export const getOrderAllocationInput = z.object({ orderId: zUuid }).strict();
export type GetOrderAllocationInput = z.infer<typeof getOrderAllocationInput>;

export interface ItemAllocationView {
  orderItemId: string;
  description: string;
  gross: Money;
  discount: Money;
  tax: Money;
  gatewayFee: Money;
  bankCharge: Money;
  distributable: Money;
  companyCut: Money;
  companyCutBps: number;
  lines: { partnerId: string; shareBps: number; amount: Money }[];
  /** `ownership_id` used, or null for project lines (split from `order_items.split_snapshot`). */
  ownershipId: string | null;
  ownershipVersion: number | null;
}

export interface OrderAllocationView {
  orderId: string;
  orderNo: string;
  currency: Currency;
  items: ItemAllocationView[];
}

// ---------------------------------------------------------------------------------------------
// API-FIN-03 getPartnerBalances (query) — `VIEW partner_balances`
// ---------------------------------------------------------------------------------------------

export const getPartnerBalancesInput = z.object({ partnerId: zUuid.optional() }).strict();
export type GetPartnerBalancesInput = z.infer<typeof getPartnerBalancesInput>;

export interface PartnerBalanceByCurrency {
  currency: Currency;
  allocated: number;
  refunded: number;
  expenses: number;
  paidOut: number;
  balance: number;
}

export interface PartnerBalance {
  partnerId: string;
  byCurrency: PartnerBalanceByCurrency[];
  balanceInrMinor: number;
}

// ---------------------------------------------------------------------------------------------
// API-FIN-04 recordPayout → `payout.record` approval; API-FIN-05 applyPayout (internal)
// ---------------------------------------------------------------------------------------------

/** Also the `payout.record` approval payload (the immutable `payouts` row is inserted on apply). */
export const recordPayoutInput = z
  .object({
    partnerId: zUuid,
    /** Must be ≤ the partner's current balance in `currency` (no override). */
    amountMinor: zPositiveMinor,
    currency: zCurrency,
    paidOn: zIsoDate,
    /** Bank / UPI transfer reference. */
    reference: zTrimmed(1, 120),
    note: zTrimmed(0, 500).optional(),
  })
  .strict();
export type RecordPayoutInput = z.infer<typeof recordPayoutInput>;
export const payoutRecordPayload = recordPayoutInput;
export type PayoutRecordPayload = RecordPayoutInput;

// ---------------------------------------------------------------------------------------------
// API-FIN-06 recordExpense (D-514) — no approval
// ---------------------------------------------------------------------------------------------

export const recordExpenseInput = z
  .object({
    /** Null/absent = company-level expense. */
    productId: zUuid.optional(),
    category: zTrimmed(1, 80),
    description: zTrimmed(0, 1000).optional(),
    amountMinor: zPositiveMinor,
    currency: zCurrency,
    incurredOn: zIsoDate,
    /** Split across the ownership active on `incurredOn` (needs `productId`). */
    sharedBySplit: z.boolean().default(true),
    receiptMediaId: zUuid.optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (e.sharedBySplit && e.productId === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "sharedBySplit needs a productId",
      });
    }
  });
export type RecordExpenseInput = z.infer<typeof recordExpenseInput>;

export interface RecordExpenseResult {
  expenseId: string;
  entryIds: string[];
}

// ---------------------------------------------------------------------------------------------
// API-FIN-07 proposeAdjustment → `ledger.adjustment` (BR-17, D-517); API-FIN-08 applyAdjustment
// ---------------------------------------------------------------------------------------------

export const adjustmentLineInput = z
  .object({
    partyType: z.enum(PARTY_TYPES),
    partnerId: zUuid.optional(),
    /** Signed, non-zero. */
    amountMinor: zSignedMinor.refine((n) => n !== 0, "adjustment amount must be non-zero"),
    currency: zCurrency,
    memo: zTrimmed(1, 500),
    orderId: zUuid.optional(),
    orderItemId: zUuid.optional(),
  })
  .strict()
  .superRefine((l, ctx) => {
    if (l.partyType === "partner" && l.partnerId === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["partnerId"],
        message: "partner lines need partnerId",
      });
    }
    if (l.partyType !== "partner" && l.partnerId !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["partnerId"],
        message: "partnerId only on partner lines",
      });
    }
  });
export type AdjustmentLineInput = z.infer<typeof adjustmentLineInput>;

/** Also the `ledger.adjustment` approval payload. */
export const proposeAdjustmentInput = z
  .object({
    lines: z.array(adjustmentLineInput).min(1).max(100),
    /** Σ must be explained here (BR-17). */
    reason: zTrimmed(1, 1000),
  })
  .strict();
export type ProposeAdjustmentInput = z.infer<typeof proposeAdjustmentInput>;
export const ledgerAdjustmentPayload = proposeAdjustmentInput;
export type LedgerAdjustmentPayload = ProposeAdjustmentInput;

// ---------------------------------------------------------------------------------------------
// API-FIN-09 getReport (query)
// ---------------------------------------------------------------------------------------------

export const getReportInput = z
  .object({
    report: z.enum(REPORT_KEYS),
    dateFrom: zIsoDate,
    dateTo: zIsoDate,
    granularity: z.enum(REPORT_GRANULARITIES).optional(),
    /** `INR` sums `amount_inr_minor`; `native` groups by entry currency. */
    currency: z.enum(REPORT_CURRENCY_MODES).optional(),
  })
  .strict()
  .refine((r) => r.dateTo >= r.dateFrom, { path: ["dateTo"], message: "dateTo before dateFrom" });
export type GetReportInput = z.infer<typeof getReportInput>;

export type ReportCell = string | number | null;
export interface ReportResult {
  report: ReportKey;
  columns: { key: string; label: string; kind: "text" | "money" | "count" | "date" }[];
  rows: Record<string, ReportCell>[];
  totals: Record<string, ReportCell>;
  currency: Currency | "mixed";
}

// ---------------------------------------------------------------------------------------------
// API-FIN-10 exportStatement
// ---------------------------------------------------------------------------------------------

export const exportStatementInput = z
  .object({
    partnerId: zUuid,
    dateFrom: zIsoDate,
    dateTo: zIsoDate,
    format: z.enum(STATEMENT_FORMATS),
  })
  .strict()
  .refine((r) => r.dateTo >= r.dateFrom, { path: ["dateTo"], message: "dateTo before dateFrom" });
export type ExportStatementInput = z.infer<typeof exportStatementInput>;

export interface StatementExport {
  /** 5-minute presigned GET to R2 `media(private)`. */
  url: string;
  filename: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------------------------
// API-FIN-11 listPayouts / listExpenses (query)
// ---------------------------------------------------------------------------------------------

const financeListFilters = z
  .object({ partnerId: zUuid.optional(), productId: zUuid.optional(), ...zDateRange })
  .strict();
export const listPayoutsInput = zListParams(["paidOn", "createdAt", "amount"], financeListFilters);
export type ListPayoutsInput = z.infer<typeof listPayoutsInput>;
export const listExpensesInput = zListParams(
  ["incurredOn", "createdAt", "amount"],
  financeListFilters,
);
export type ListExpensesInput = z.infer<typeof listExpensesInput>;

// ---------------------------------------------------------------------------------------------
// Posting results (master plan §5 signatures live in ./contracts)
// ---------------------------------------------------------------------------------------------

export interface PostOrderPaidResult {
  entryIds: string[];
  allocationIds: string[];
  entryCount: number;
}
export interface PostEntriesResult {
  entryIds: string[];
  entryCount: number;
}

// ---------------------------------------------------------------------------------------------
// §4.2 pure allocation contract — `computeAllocation(input)`
// ---------------------------------------------------------------------------------------------

/**
 * Per-item posting input. Deductions are already spread across the order's items pro-rata by
 * item total (`spreadDeduction`). `lines` come from the ownership version active at payment
 * time (product lines) or the approved `split_snapshot` (project lines); shares sum to 10 000.
 */
export const computeAllocationInput = z
  .object({
    currency: zCurrency,
    /** Item total excluding the customer credit (overpayment is excluded from gross). */
    grossMinor: zMinor,
    discountMinor: zMinor,
    taxMinor: zMinor,
    gatewayFeeMinor: zMinor,
    bankShortfallMinor: zMinor,
    companyCutBps: zBps,
    lines: z.array(zSplitLine).min(1).max(20),
  })
  .strict()
  .superRefine((a, ctx) => {
    const sum = a.lines.reduce((acc, l) => acc + l.shareBps, 0);
    if (sum !== 10_000) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: `share_bps must sum to 10000, got ${String(sum)}`,
      });
    }
    const deductions = a.discountMinor + a.taxMinor + a.gatewayFeeMinor + a.bankShortfallMinor;
    if (deductions > a.grossMinor) {
      ctx.addIssue({
        code: "custom",
        path: ["grossMinor"],
        message: "deductions exceed gross (distributable would be negative)",
      });
    }
  });
export type ComputeAllocationInput = z.infer<typeof computeAllocationInput>;

export interface AllocationResult {
  currency: Currency;
  /** gross − discount − tax − gatewayFee − bankShortfall */
  distributableMinor: number;
  /** distributable × companyCutBps / 10000, half-up. */
  companyMinor: number;
  /** Largest-remainder shares of (distributable − company); Σ lines + company = distributable. */
  lines: AllocationLine[];
}

/** The pure function P4 implements and `computeAllocationReference` documents. No DB, no floats. */
export type ComputeAllocation = (input: ComputeAllocationInput) => AllocationResult;

/**
 * Reference implementation of docs/06 §4.2 (exercised by property tests; P4 may re-export it).
 * Invariants: `Σ lines.amount_minor + companyMinor === distributableMinor`; every line within one
 * minor unit of its ideal share; deterministic for equal inputs.
 */
export const computeAllocationReference: ComputeAllocation = (raw) => {
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
  const partnerPool = distributableMinor - companyMinor;
  const parts = allocateLargestRemainder(
    partnerPool,
    input.lines.map((l) => l.shareBps),
  );
  return {
    currency: input.currency,
    distributableMinor,
    companyMinor,
    lines: input.lines.map((l, i) => ({
      partner_id: l.partnerId,
      share_bps: l.shareBps,
      amount_minor: parts[i] as number,
    })),
  };
};

/**
 * Spread an order-level deduction (gateway fee, bank shortfall) across items pro-rata by item
 * total, largest-remainder rounded so the parts sum to `totalMinor` exactly (docs/06 §4.2).
 */
export type SpreadDeduction = (totalMinor: number, itemTotalsMinor: readonly number[]) => number[];

export const spreadDeductionReference: SpreadDeduction = (totalMinor, itemTotalsMinor) => {
  if (itemTotalsMinor.length === 0) throw new RangeError("at least one item is required");
  if (itemTotalsMinor.every((t) => t === 0)) {
    // Nothing to weight by: give everything to the first item (deterministic, sums exactly).
    return itemTotalsMinor.map((_, i) => (i === 0 ? totalMinor : 0));
  }
  return allocateLargestRemainder(totalMinor, itemTotalsMinor);
};

export type { Allocation, AllocationLine, EntryType, Expense, LedgerEntry, PartyType, Payout };
