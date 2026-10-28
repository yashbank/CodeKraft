/**
 * Single source of truth for the finance metrics shown in reports, statements, the finance
 * dashboard widgets and the ledger screens. Read-only: derives everything from `ledger_entries`
 * (append-only, never rewritten) plus `orders` for the outstanding figure.
 *
 * Definitions (all INR minor units, signs ignored via ABS so refund sign conventions never leak):
 *   Gross sales        = Σ sale                      (list price x qty)
 *   Discounts          = Σ discount                  (coupons / manual discounts)
 *   Net sales          = Gross sales - Discounts     (ex-tax)
 *   Tax collected      = Σ tax_collected
 *   Collected          = Net sales + Tax collected   (what customers were billed / paid)
 *   Gateway fees       = Σ gateway_fee ; Bank shortfall = Σ bank_charge
 *   Refunds            = Σ refund_sale - Σ refund_discount + Σ refund_tax   (cash handed back)
 *   Company share      = Σ company_cut - Σ refund_company_cut
 *   Partner shares     = Σ partner_allocation - Σ refund_partner_allocation
 *   Expenses           = Σ expense
 *   Profit             = Company share + Partner shares - Expenses
 *                        (the distributable pool, already net of tax, fees and refunds, less expenses)
 *   Outstanding        = Σ total of unpaid (`pending_payment`) INR orders, i.e. initiated /
 *                        submitted payments and orders with no payment yet.
 *
 * Identities: Gross - Discounts = Net sales; Net sales + Tax = Collected.
 */
import { sql, type SQL } from "drizzle-orm";
import { toMinor } from "./minor";

/** Raw per-entry-type absolute sums. Keys are the SQL column aliases from `rawSumsSql`. */
export interface RawLedgerSums {
  sale: number;
  discount: number;
  tax: number;
  gatewayFee: number;
  bankCharge: number;
  companyCut: number;
  partnerAllocation: number;
  refundSale: number;
  refundDiscount: number;
  refundTax: number;
  refundCompanyCut: number;
  refundPartnerAllocation: number;
  expense: number;
}

export interface FinanceMetrics {
  grossSalesMinor: number;
  discountsMinor: number;
  netSalesMinor: number;
  taxCollectedMinor: number;
  collectedMinor: number;
  gatewayFeesMinor: number;
  bankShortfallMinor: number;
  /** gateway fees + bank shortfall */
  feesMinor: number;
  refundsMinor: number;
  companyShareMinor: number;
  partnerSharesMinor: number;
  expensesMinor: number;
  profitMinor: number;
}

export const EMPTY_RAW_SUMS: RawLedgerSums = {
  sale: 0,
  discount: 0,
  tax: 0,
  gatewayFee: 0,
  bankCharge: 0,
  companyCut: 0,
  partnerAllocation: 0,
  refundSale: 0,
  refundDiscount: 0,
  refundTax: 0,
  refundCompanyCut: 0,
  refundPartnerAllocation: 0,
  expense: 0,
};

/** Pure: raw sums -> labelled metrics. */
export function deriveMetrics(raw: RawLedgerSums): FinanceMetrics {
  const netSales = raw.sale - raw.discount;
  const companyShare = raw.companyCut - raw.refundCompanyCut;
  const partnerShares = raw.partnerAllocation - raw.refundPartnerAllocation;
  return {
    grossSalesMinor: raw.sale,
    discountsMinor: raw.discount,
    netSalesMinor: netSales,
    taxCollectedMinor: raw.tax,
    collectedMinor: netSales + raw.tax,
    gatewayFeesMinor: raw.gatewayFee,
    bankShortfallMinor: raw.bankCharge,
    feesMinor: raw.gatewayFee + raw.bankCharge,
    refundsMinor: raw.refundSale - raw.refundDiscount + raw.refundTax,
    companyShareMinor: companyShare,
    partnerSharesMinor: partnerShares,
    expensesMinor: raw.expense,
    profitMinor: companyShare + partnerShares - raw.expense,
  };
}

export function addRawSums(a: RawLedgerSums, b: RawLedgerSums): RawLedgerSums {
  const out = { ...a };
  for (const k of Object.keys(out) as (keyof RawLedgerSums)[]) out[k] += b[k];
  return out;
}

const TYPE_COLUMNS: Array<[keyof RawLedgerSums, string]> = [
  ["sale", "sale"],
  ["discount", "discount"],
  ["tax", "tax_collected"],
  ["gatewayFee", "gateway_fee"],
  ["bankCharge", "bank_charge"],
  ["companyCut", "company_cut"],
  ["partnerAllocation", "partner_allocation"],
  ["refundSale", "refund_sale"],
  ["refundDiscount", "refund_discount"],
  ["refundTax", "refund_tax"],
  ["refundCompanyCut", "refund_company_cut"],
  ["refundPartnerAllocation", "refund_partner_allocation"],
  ["expense", "expense"],
];

/** SQL select-list fragment: one `m_<key>` aggregate column per raw sum, for ledger alias `alias`. */
export function rawSumsSql(alias = "le"): SQL {
  const cols = TYPE_COLUMNS.map(
    ([key, type]) =>
      `COALESCE(SUM(CASE WHEN ${alias}.entry_type = '${type}' THEN ABS(${alias}.amount_inr_minor) ELSE 0 END), 0) AS m_${key.toLowerCase()}`,
  );
  return sql.raw(cols.join(",\n          "));
}

/** Reads the `m_*` columns of a result row produced with `rawSumsSql`. */
export function rawSumsFromRow(row: Record<string, unknown>): RawLedgerSums {
  const out = { ...EMPTY_RAW_SUMS };
  for (const [key] of TYPE_COLUMNS)
    out[key] = toMinor(row[`m_${key.toLowerCase()}`] as string | number | null);
  return out;
}
