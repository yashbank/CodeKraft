/**
 * Finance reports implementation (API-FIN-09, FR-FIN-10..14, D-513, master plan §6).
 *
 * Computed strictly from `ledger_entries`, `allocations`, and views (`partner_balances`, `customer_credits`).
 */
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { ledgerEntries, allocations, type EntryType } from "../../../drizzle/schema/finance";
import { orderItems, orders } from "../../../drizzle/schema/commerce";
import { products } from "../../../drizzle/schema/catalog";
import { partners } from "../../../drizzle/schema/users-ext";
import {
  getReportInput,
  type Currency,
  type GetReportInput,
  type ReportCell,
  type ReportResult,
} from "./types";

export async function getReport(
  ctx: RequestContext,
  rawInput: GetReportInput,
  database: DbOrTx = db,
): Promise<ReportResult> {
  assertPermission(ctx, "finance.reports.read");
  const input = getReportInput.parse(rawInput);

  const fromDate = `${input.dateFrom}T00:00:00.000Z`;
  const toDate = `${input.dateTo}T23:59:59.999Z`;
  const currencyMode = input.currency ?? "INR";

  switch (input.report) {
    case "revenue_by_product": {
      // Aggregate ledger entries by product
      const rows = await database.execute<{
        product_id: string;
        title: string;
        gross_minor: string;
        discount_minor: string;
        tax_minor: string;
        refund_minor: string;
        net_minor: string;
        order_count: string;
      }>(sql`
        SELECT
          p.id AS product_id,
          p.name AS title,
          COALESCE(SUM(CASE WHEN le.entry_type = 'sale' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS gross_minor,
          COALESCE(SUM(CASE WHEN le.entry_type = 'discount' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS discount_minor,
          COALESCE(SUM(CASE WHEN le.entry_type = 'tax_collected' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS tax_minor,
          COALESCE(SUM(CASE WHEN le.entry_type IN ('refund_sale', 'refund_discount', 'refund_tax') THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS refund_minor,
          COALESCE(SUM(CASE 
            WHEN le.entry_type = 'sale' THEN ABS(le.amount_inr_minor)
            WHEN le.entry_type = 'discount' THEN -ABS(le.amount_inr_minor)
            WHEN le.entry_type = 'tax_collected' THEN -ABS(le.amount_inr_minor)
            WHEN le.entry_type IN ('refund_sale', 'refund_discount') THEN -ABS(le.amount_inr_minor)
            ELSE 0 
          END), 0) AS net_minor,
          COUNT(DISTINCT oi.order_id) AS order_count
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN ledger_entries le ON le.order_item_id = oi.id 
          AND le.created_at >= ${fromDate} AND le.created_at <= ${toDate}
        GROUP BY p.id, p.name
        ORDER BY net_minor DESC, p.name ASC
      `);

      let totalGross = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      let totalRefund = 0;
      let totalNet = 0;
      let totalOrders = 0;

      const reportRows = rows.map((r) => {
        const gross = Number(r.gross_minor);
        const discount = Number(r.discount_minor);
        const tax = Number(r.tax_minor);
        const refund = Number(r.refund_minor);
        const net = Number(r.net_minor);
        const orderCount = Number(r.order_count);

        totalGross += gross;
        totalDiscount += discount;
        totalTax += tax;
        totalRefund += refund;
        totalNet += net;
        totalOrders += orderCount;

        return {
          productId: r.product_id,
          title: r.title,
          grossMinor: gross,
          discountMinor: discount,
          taxMinor: tax,
          refundMinor: refund,
          netMinor: net,
          orderCount,
        };
      });

      return {
        report: "revenue_by_product",
        columns: [
          { key: "productId", label: "Product ID", kind: "text" },
          { key: "title", label: "Product Title", kind: "text" },
          { key: "grossMinor", label: "Gross Revenue", kind: "money" },
          { key: "discountMinor", label: "Discounts", kind: "money" },
          { key: "taxMinor", label: "Tax", kind: "money" },
          { key: "refundMinor", label: "Refunds", kind: "money" },
          { key: "netMinor", label: "Net Revenue", kind: "money" },
          { key: "orderCount", label: "Orders", kind: "count" },
        ],
        rows: reportRows,
        totals: {
          grossMinor: totalGross,
          discountMinor: totalDiscount,
          taxMinor: totalTax,
          refundMinor: totalRefund,
          netMinor: totalNet,
          orderCount: totalOrders,
        },
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
        const allocated = Number(r.allocated_minor);
        const refunded = Number(r.refunded_minor);
        const net = Number(r.net_allocated_minor);

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
      const rows = await database.execute<{
        period: string;
        gross_minor: string;
        refund_minor: string;
        net_minor: string;
      }>(sql`
        SELECT
          TO_CHAR(le.created_at, 'YYYY-MM') AS period,
          COALESCE(SUM(CASE WHEN le.entry_type = 'sale' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS gross_minor,
          COALESCE(SUM(CASE WHEN le.entry_type::text LIKE 'refund_%' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS refund_minor,
          COALESCE(SUM(CASE 
            WHEN le.entry_type = 'sale' THEN ABS(le.amount_inr_minor)
            WHEN le.entry_type::text LIKE 'refund_%' THEN -ABS(le.amount_inr_minor)
            ELSE 0 
          END), 0) AS net_minor
        FROM ledger_entries le
        WHERE le.created_at >= ${fromDate} AND le.created_at <= ${toDate}
        GROUP BY TO_CHAR(le.created_at, 'YYYY-MM')
        ORDER BY period ASC
      `);

      let totalGross = 0;
      let totalRefund = 0;
      let totalNet = 0;

      const reportRows = rows.map((r) => {
        const gross = Number(r.gross_minor);
        const refund = Number(r.refund_minor);
        const net = Number(r.net_minor);

        totalGross += gross;
        totalRefund += refund;
        totalNet += net;

        return {
          period: r.period,
          grossMinor: gross,
          refundMinor: refund,
          netMinor: net,
        };
      });

      return {
        report: "revenue_by_period",
        columns: [
          { key: "period", label: "Period", kind: "text" },
          { key: "grossMinor", label: "Gross Revenue", kind: "money" },
          { key: "refundMinor", label: "Refunds", kind: "money" },
          { key: "netMinor", label: "Net Revenue", kind: "money" },
        ],
        rows: reportRows,
        totals: {
          grossMinor: totalGross,
          refundMinor: totalRefund,
          netMinor: totalNet,
        },
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
        const collected = Number(r.tax_collected_minor);
        const refunded = Number(r.tax_refunded_minor);
        const net = Number(r.net_tax_minor);

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
          SUM(ABS(le.amount_inr_minor)) AS refund_total_minor,
          COALESCE(MAX(le.memo), 'Refund') AS memo
        FROM ledger_entries le
        LEFT JOIN orders o ON o.id = le.order_id
        WHERE le.created_at >= ${fromDate} AND le.created_at <= ${toDate}
          AND le.entry_type::text LIKE 'refund_%'
        GROUP BY TO_CHAR(le.created_at, 'YYYY-MM-DD'), le.order_id, o.order_no
        ORDER BY date DESC
      `);

      let totalRefunds = 0;
      const reportRows = rows.map((r) => {
        const amt = Number(r.refund_total_minor);
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
          { key: "refundTotalMinor", label: "Refund Total", kind: "money" },
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
        const balInr = Number(r.balance_inr_minor);
        totalInr += balInr;
        return {
          partnerId: r.partner_id,
          partnerName: r.display_name,
          currency: r.currency,
          balanceMinor: Number(r.balance_minor),
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
      // FR-FIN-14: Σ sale − discount − refunds − Σ expenses linked to product
      const rows = await database.execute<{
        product_id: string;
        title: string;
        sale_minor: string;
        discount_minor: string;
        refund_minor: string;
        expense_minor: string;
        profit_minor: string;
      }>(sql`
        SELECT
          p.id AS product_id,
          p.name AS title,
          COALESCE(SUM(CASE WHEN le.entry_type = 'sale' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS sale_minor,
          COALESCE(SUM(CASE WHEN le.entry_type = 'discount' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS discount_minor,
          COALESCE(SUM(CASE WHEN le.entry_type::text LIKE 'refund_%' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS refund_minor,
          COALESCE(SUM(CASE WHEN le.entry_type = 'expense' THEN ABS(le.amount_inr_minor) ELSE 0 END), 0) AS expense_minor,
          COALESCE(SUM(CASE 
            WHEN le.entry_type = 'sale' THEN ABS(le.amount_inr_minor)
            WHEN le.entry_type = 'discount' THEN -ABS(le.amount_inr_minor)
            WHEN le.entry_type::text LIKE 'refund_%' THEN -ABS(le.amount_inr_minor)
            WHEN le.entry_type = 'expense' THEN -ABS(le.amount_inr_minor)
            ELSE 0 
          END), 0) AS profit_minor
        FROM products p
        LEFT JOIN (
          SELECT le.*, COALESCE(oi.product_id, exp.product_id) AS matched_product_id
          FROM ledger_entries le
          LEFT JOIN order_items oi ON oi.id = le.order_item_id
          LEFT JOIN expenses exp ON exp.id = le.expense_id
          WHERE le.created_at >= ${fromDate} AND le.created_at <= ${toDate}
        ) le ON le.matched_product_id = p.id
        GROUP BY p.id, p.name
        ORDER BY profit_minor DESC, p.name ASC
      `);

      let totalSales = 0;
      let totalDiscounts = 0;
      let totalRefunds = 0;
      let totalExpenses = 0;
      let totalProfit = 0;

      const reportRows = rows.map((r) => {
        const sale = Number(r.sale_minor);
        const discount = Number(r.discount_minor);
        const refund = Number(r.refund_minor);
        const exp = Number(r.expense_minor);
        const profit = Number(r.profit_minor);

        totalSales += sale;
        totalDiscounts += discount;
        totalRefunds += refund;
        totalExpenses += exp;
        totalProfit += profit;

        return {
          productId: r.product_id,
          productTitle: r.title,
          saleMinor: sale,
          discountMinor: discount,
          refundMinor: refund,
          expenseMinor: exp,
          profitMinor: profit,
        };
      });

      return {
        report: "profit_by_product",
        columns: [
          { key: "productId", label: "Product ID", kind: "text" },
          { key: "productTitle", label: "Product Title", kind: "text" },
          { key: "saleMinor", label: "Sales", kind: "money" },
          { key: "discountMinor", label: "Discounts", kind: "money" },
          { key: "refundMinor", label: "Refunds", kind: "money" },
          { key: "expenseMinor", label: "Expenses", kind: "money" },
          { key: "profitMinor", label: "Net Profit", kind: "money" },
        ],
        rows: reportRows,
        totals: {
          saleMinor: totalSales,
          discountMinor: totalDiscounts,
          refundMinor: totalRefunds,
          expenseMinor: totalExpenses,
          profitMinor: totalProfit,
        },
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
      }>(sql`
        SELECT
          payment_id,
          order_id,
          order_no,
          user_id,
          client_email,
          currency,
          credit_minor,
          credit_inr_minor
        FROM customer_credits
        ORDER BY credit_inr_minor DESC
      `);

      let totalCreditInr = 0;
      const reportRows = rows.map((r) => {
        const credInr = Number(r.credit_inr_minor);
        totalCreditInr += credInr;
        return {
          paymentId: r.payment_id,
          orderId: r.order_id,
          orderNo: r.order_no,
          userId: r.user_id,
          clientEmail: r.client_email,
          currency: r.currency,
          creditMinor: Number(r.credit_minor),
          creditInrMinor: credInr,
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
