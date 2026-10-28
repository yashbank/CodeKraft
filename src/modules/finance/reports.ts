/**
 * Finance reports implementation (API-FIN-09, FR-FIN-10..14, D-513, master plan §6).
 *
 * Computed strictly from `ledger_entries`, `allocations`, and views (`partner_balances`, `customer_credits`).
 */
import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { toMinor } from "./minor";
import {
  EMPTY_RAW_SUMS,
  addRawSums,
  deriveMetrics,
  rawSumsFromRow,
  rawSumsSql,
  type FinanceMetrics,
} from "./metrics-core";
import { getReportInput, type GetReportInput, type ReportResult } from "./types";

/** Shared sales columns so every report labels and computes the same metrics (see ./metrics.ts). */
const SALE_COLUMNS: ReportResult["columns"] = [
  { key: "grossMinor", label: "Gross sales (list price)", kind: "money" },
  { key: "discountMinor", label: "Discounts / coupons", kind: "money" },
  { key: "netMinor", label: "Net sales (gross - discounts)", kind: "money" },
  { key: "taxMinor", label: "Tax collected", kind: "money" },
  { key: "collectedMinor", label: "Collected (net + tax)", kind: "money" },
  { key: "refundMinor", label: "Refunds", kind: "money" },
  { key: "feesMinor", label: "Gateway fees / bank shortfall", kind: "money" },
  { key: "companyShareMinor", label: "Company share", kind: "money" },
  { key: "partnerSharesMinor", label: "Partner shares", kind: "money" },
];

function saleCells(m: FinanceMetrics) {
  return {
    grossMinor: m.grossSalesMinor,
    discountMinor: m.discountsMinor,
    netMinor: m.netSalesMinor,
    taxMinor: m.taxCollectedMinor,
    collectedMinor: m.collectedMinor,
    refundMinor: m.refundsMinor,
    feesMinor: m.feesMinor,
    companyShareMinor: m.companyShareMinor,
    partnerSharesMinor: m.partnerSharesMinor,
  };
}

export async function getReport(
  ctx: RequestContext,
  rawInput: GetReportInput,
  database: DbOrTx = db,
): Promise<ReportResult> {
  assertPermission(ctx, "finance.reports.read");
  const input = getReportInput.parse(rawInput);

  const fromDate = `${input.dateFrom}T00:00:00.000Z`;
  const toDate = `${input.dateTo}T23:59:59.999Z`;

  switch (input.report) {
    case "revenue_by_product": {
      const rows = await database.execute<Record<string, unknown>>(sql`
        SELECT
          p.id AS product_id,
          p.name AS title,
          ${rawSumsSql("le")},
          COUNT(DISTINCT CASE WHEN le.entry_type = 'sale' THEN le.order_id END) AS order_count
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN ledger_entries le ON le.order_item_id = oi.id
          AND le.created_at >= ${fromDate} AND le.created_at <= ${toDate}
        GROUP BY p.id, p.name
        ORDER BY (COALESCE(SUM(CASE WHEN le.entry_type = 'sale' THEN ABS(le.amount_inr_minor) WHEN le.entry_type = 'discount' THEN -ABS(le.amount_inr_minor) ELSE 0 END), 0)) DESC, p.name ASC
      `);

      let totalRaw = EMPTY_RAW_SUMS;
      let totalOrders = 0;
      const reportRows = rows.map((r) => {
        const raw = rawSumsFromRow(r);
        totalRaw = addRawSums(totalRaw, raw);
        const orderCount = toMinor(r.order_count as string);
        totalOrders += orderCount;
        return {
          productId: String(r.product_id),
          title: String(r.title),
          ...saleCells(deriveMetrics(raw)),
          orderCount,
        };
      });

      return {
        report: "revenue_by_product",
        columns: [
          { key: "productId", label: "Product ID", kind: "text" },
          { key: "title", label: "Product Title", kind: "text" },
          ...SALE_COLUMNS,
          { key: "orderCount", label: "Orders", kind: "count" },
        ],
        rows: reportRows,
        totals: { ...saleCells(deriveMetrics(totalRaw)), orderCount: totalOrders },
        currency: "INR",
      };
    }

    case "revenue_by_partner": {
      const rows = await database.execute<{
        partner_id: string;
        display_name: string;
        allocated_minor: string;
        refunded_minor: string;
        net_allocated_minor: string;
      }>(sql`
        SELECT
          p.id AS partner_id,
          p.display_name,
          COALESCE(SUM(CASE WHEN le.entry_type = 'partner_allocation' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS allocated_minor,
          COALESCE(SUM(CASE WHEN le.entry_type = 'refund_partner_allocation' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS refunded_minor,
          COALESCE(SUM(CASE 
            WHEN le.entry_type = 'partner_allocation' THEN ABS(le.amount_inr_minor)
            WHEN le.entry_type = 'refund_partner_allocation' THEN -ABS(le.amount_inr_minor)
            ELSE 0 
          END), 0) AS net_allocated_minor
        FROM partners p
        LEFT JOIN ledger_entries le ON le.partner_id = p.id 
          AND le.created_at >= ${fromDate} AND le.created_at <= ${toDate}
        GROUP BY p.id, p.display_name
        ORDER BY net_allocated_minor DESC, p.display_name ASC
      `);

      let totalAllocated = 0;
      let totalRefunded = 0;
      let totalNet = 0;

      const reportRows = rows.map((r) => {
        const allocated = toMinor(r.allocated_minor);
        const refunded = toMinor(r.refunded_minor);
        const net = toMinor(r.net_allocated_minor);

        totalAllocated += allocated;
        totalRefunded += refunded;
        totalNet += net;

        return {
          partnerId: r.partner_id,
          displayName: r.display_name,
          allocatedMinor: allocated,
          refundedMinor: refunded,
          netAllocatedMinor: net,
        };
      });

      return {
        report: "revenue_by_partner",
        columns: [
          { key: "partnerId", label: "Partner ID", kind: "text" },
          { key: "displayName", label: "Partner Name", kind: "text" },
          { key: "allocatedMinor", label: "Allocated", kind: "money" },
          { key: "refundedMinor", label: "Refunded", kind: "money" },
          { key: "netAllocatedMinor", label: "Net Allocated", kind: "money" },
        ],
        rows: reportRows,
        totals: {
          allocatedMinor: totalAllocated,
          refundedMinor: totalRefunded,
          netAllocatedMinor: totalNet,
        },
        currency: "INR",
      };
    }

    case "revenue_by_period": {
      const rows = await database.execute<Record<string, unknown>>(sql`
        SELECT
          TO_CHAR(le.created_at, 'YYYY-MM') AS period,
          ${rawSumsSql("le")}
        FROM ledger_entries le
        WHERE le.created_at >= ${fromDate} AND le.created_at <= ${toDate}
        GROUP BY TO_CHAR(le.created_at, 'YYYY-MM')
        ORDER BY period ASC
      `);

      let totalRaw = EMPTY_RAW_SUMS;
      const reportRows = rows.map((r) => {
        const raw = rawSumsFromRow(r);
        totalRaw = addRawSums(totalRaw, raw);
        const m = deriveMetrics(raw);
        return {
          period: String(r.period),
          ...saleCells(m),
          expenseMinor: m.expensesMinor,
          profitMinor: m.profitMinor,
        };
      });
      const tm = deriveMetrics(totalRaw);

      return {
        report: "revenue_by_period",
        columns: [
          { key: "period", label: "Period", kind: "text" },
          ...SALE_COLUMNS,
          { key: "expenseMinor", label: "Expenses", kind: "money" },
          { key: "profitMinor", label: "Profit", kind: "money" },
        ],
        rows: reportRows,
        totals: { ...saleCells(tm), expenseMinor: tm.expensesMinor, profitMinor: tm.profitMinor },
        currency: "INR",
      };
    }

    case "tax_collected": {
      const rows = await database.execute<{
        period: string;
        tax_collected_minor: string;
        tax_refunded_minor: string;
        net_tax_minor: string;
      }>(sql`
        SELECT
          TO_CHAR(le.created_at, 'YYYY-MM') AS period,
          COALESCE(SUM(CASE WHEN le.entry_type = 'tax_collected' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS tax_collected_minor,
          COALESCE(SUM(CASE WHEN le.entry_type = 'refund_tax' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS tax_refunded_minor,
          COALESCE(SUM(CASE 
            WHEN le.entry_type = 'tax_collected' THEN ABS(le.amount_inr_minor)
            WHEN le.entry_type = 'refund_tax' THEN -ABS(le.amount_inr_minor)
            ELSE 0 
          END), 0) AS net_tax_minor
        FROM ledger_entries le
        WHERE le.created_at >= ${fromDate} AND le.created_at <= ${toDate}
          AND le.entry_type IN ('tax_collected', 'refund_tax')
        GROUP BY TO_CHAR(le.created_at, 'YYYY-MM')
        ORDER BY period ASC
      `);

      let totalCollected = 0;
      let totalRefunded = 0;
      let totalNet = 0;

      const reportRows = rows.map((r) => {
        const collected = toMinor(r.tax_collected_minor);
        const refunded = toMinor(r.tax_refunded_minor);
        const net = toMinor(r.net_tax_minor);

        totalCollected += collected;
        totalRefunded += refunded;
        totalNet += net;

        return {
          period: r.period,
          taxCollectedMinor: collected,
          taxRefundedMinor: refunded,
          netTaxMinor: net,
        };
      });

      return {
        report: "tax_collected",
        columns: [
          { key: "period", label: "Period", kind: "text" },
          { key: "taxCollectedMinor", label: "Tax Collected", kind: "money" },
          { key: "taxRefundedMinor", label: "Tax Refunded", kind: "money" },
          { key: "netTaxMinor", label: "Net Tax", kind: "money" },
        ],
        rows: reportRows,
        totals: {
          taxCollectedMinor: totalCollected,
          taxRefundedMinor: totalRefunded,
          netTaxMinor: totalNet,
        },
        currency: "INR",
      };
    }

    case "refunds": {
      // Cash refunded = refund_sale - refund_discount + refund_tax (never the sum of every reversal leg).
      const rows = await database.execute<{
        date: string;
        order_id: string;
        order_no: string;
        refund_total_minor: string;
        memo: string;
      }>(sql`
        SELECT
          TO_CHAR(le.created_at, 'YYYY-MM-DD') AS date,
          le.order_id,
          COALESCE(o.order_no, '') AS order_no,
          SUM(CASE
            WHEN le.entry_type = 'refund_sale' THEN ABS(le.amount_inr_minor)
            WHEN le.entry_type = 'refund_discount' THEN -ABS(le.amount_inr_minor)
            WHEN le.entry_type = 'refund_tax' THEN ABS(le.amount_inr_minor)
            ELSE 0 END) AS refund_total_minor,
          COALESCE(MAX(le.memo), 'Refund') AS memo
        FROM ledger_entries le
        LEFT JOIN orders o ON o.id = le.order_id
        WHERE le.created_at >= ${fromDate} AND le.created_at <= ${toDate}
          AND le.entry_type IN ('refund_sale', 'refund_discount', 'refund_tax')
        GROUP BY TO_CHAR(le.created_at, 'YYYY-MM-DD'), le.order_id, o.order_no
        ORDER BY date DESC
      `);

      let totalRefunds = 0;
      const reportRows = rows.map((r) => {
        const amt = toMinor(r.refund_total_minor);
        totalRefunds += amt;
        return {
          date: r.date,
          orderId: r.order_id,
          orderNo: r.order_no,
          refundTotalMinor: amt,
          reason: r.memo,
        };
      });

      return {
        report: "refunds",
        columns: [
          { key: "date", label: "Date", kind: "date" },
          { key: "orderId", label: "Order ID", kind: "text" },
          { key: "orderNo", label: "Order #", kind: "text" },
          { key: "refundTotalMinor", label: "Refunds (cash returned)", kind: "money" },
          { key: "reason", label: "Reason", kind: "text" },
        ],
        rows: reportRows,
        totals: {
          refundTotalMinor: totalRefunds,
        },
        currency: "INR",
      };
    }

    case "outstanding_payouts": {
      const rows = await database.execute<{
        partner_id: string;
        display_name: string;
        currency: string;
        balance_minor: string;
        balance_inr_minor: string;
      }>(sql`
        SELECT
          pb.partner_id,
          p.display_name,
          pb.currency,
          pb.balance_minor,
          pb.balance_inr_minor
        FROM partner_balances pb
        JOIN partners p ON p.id = pb.partner_id
        WHERE pb.balance_minor > 0
        ORDER BY pb.balance_inr_minor DESC
      `);

      let totalInr = 0;
      const reportRows = rows.map((r) => {
        const balInr = toMinor(r.balance_inr_minor);
        totalInr += balInr;
        return {
          partnerId: r.partner_id,
          partnerName: r.display_name,
          currency: r.currency,
          balanceMinor: toMinor(r.balance_minor),
          balanceInrMinor: balInr,
        };
      });

      return {
        report: "outstanding_payouts",
        columns: [
          { key: "partnerId", label: "Partner ID", kind: "text" },
          { key: "partnerName", label: "Partner Name", kind: "text" },
          { key: "currency", label: "Currency", kind: "text" },
          { key: "balanceMinor", label: "Balance (Native)", kind: "money" },
          { key: "balanceInrMinor", label: "Balance (INR)", kind: "money" },
        ],
        rows: reportRows,
        totals: {
          balanceInrMinor: totalInr,
        },
        currency: "INR",
      };
    }

    case "profit_by_product": {
      // Profit = company share + partner shares - expenses (see ./metrics.ts).
      const rows = await database.execute<Record<string, unknown>>(sql`
        SELECT
          p.id AS product_id,
          p.name AS title,
          ${rawSumsSql("le")}
        FROM products p
        LEFT JOIN (
          SELECT le.*, COALESCE(oi.product_id, exp.product_id) AS matched_product_id
          FROM ledger_entries le
          LEFT JOIN order_items oi ON oi.id = le.order_item_id
          LEFT JOIN expenses exp ON exp.id = le.expense_id
          WHERE le.created_at >= ${fromDate} AND le.created_at <= ${toDate}
        ) le ON le.matched_product_id = p.id
        GROUP BY p.id, p.name
        ORDER BY (COALESCE(SUM(CASE WHEN le.entry_type IN ('company_cut','partner_allocation') THEN ABS(le.amount_inr_minor)
                                    WHEN le.entry_type IN ('refund_company_cut','refund_partner_allocation','expense') THEN -ABS(le.amount_inr_minor)
                                    ELSE 0 END), 0)) DESC, p.name ASC
      `);

      let totalRaw = EMPTY_RAW_SUMS;
      const cells = (m: FinanceMetrics) => ({
        saleMinor: m.grossSalesMinor,
        discountMinor: m.discountsMinor,
        taxMinor: m.taxCollectedMinor,
        refundMinor: m.refundsMinor,
        feesMinor: m.feesMinor,
        expenseMinor: m.expensesMinor,
        profitMinor: m.profitMinor,
      });
      const reportRows = rows.map((r) => {
        const raw = rawSumsFromRow(r);
        totalRaw = addRawSums(totalRaw, raw);
        return {
          productId: String(r.product_id),
          productTitle: String(r.title),
          ...cells(deriveMetrics(raw)),
        };
      });

      return {
        report: "profit_by_product",
        columns: [
          { key: "productId", label: "Product ID", kind: "text" },
          { key: "productTitle", label: "Product Title", kind: "text" },
          { key: "saleMinor", label: "Gross sales (list price)", kind: "money" },
          { key: "discountMinor", label: "Discounts / coupons", kind: "money" },
          { key: "taxMinor", label: "Tax collected", kind: "money" },
          { key: "refundMinor", label: "Refunds", kind: "money" },
          { key: "feesMinor", label: "Gateway fees / bank shortfall", kind: "money" },
          { key: "expenseMinor", label: "Expenses", kind: "money" },
          { key: "profitMinor", label: "Profit", kind: "money" },
        ],
        rows: reportRows,
        totals: cells(deriveMetrics(totalRaw)),
        currency: "INR",
      };
    }

    case "customer_credits": {
      const rows = await database.execute<{
        payment_id: string;
        order_id: string;
        order_no: string;
        user_id: string;
        client_email: string;
        currency: string;
        credit_minor: string;
        credit_inr_minor: string;
        amount_refunded_minor: string;
      }>(sql`
        SELECT
          payment_id,
          order_id,
          order_no,
          user_id,
          client_email,
          currency,
          credit_minor,
          credit_inr_minor,
          amount_refunded_minor
        FROM customer_credits
        ORDER BY credit_inr_minor DESC
      `);

      let totalCreditInr = 0;
      const reportRows = rows.map((r) => {
        const credInr = toMinor(r.credit_inr_minor);
        totalCreditInr += credInr;
        return {
          paymentId: r.payment_id,
          orderId: r.order_id,
          orderNo: r.order_no,
          userId: r.user_id,
          clientEmail: r.client_email,
          currency: r.currency,
          creditMinor: toMinor(r.credit_minor),
          creditInrMinor: credInr,
          // Not a `columns` entry (not shown in the generic reports table): the admin finance
          // reports page uses this to derive `CustomerCreditRow.state` ("refunded" once the view's
          // `amount_refunded_minor` covers the credit, "open" otherwise -- `customer_credits` has
          // no other state/status column, so "applied" is never derived here).
          amountRefundedMinor: toMinor(r.amount_refunded_minor),
        };
      });

      return {
        report: "customer_credits",
        columns: [
          { key: "paymentId", label: "Payment ID", kind: "text" },
          { key: "orderNo", label: "Order #", kind: "text" },
          { key: "clientEmail", label: "Customer Email", kind: "text" },
          { key: "currency", label: "Currency", kind: "text" },
          { key: "creditMinor", label: "Credit (Native)", kind: "money" },
          { key: "creditInrMinor", label: "Credit (INR)", kind: "money" },
        ],
        rows: reportRows,
        totals: {
          creditInrMinor: totalCreditInr,
        },
        currency: "INR",
      };
    }
  }
}
