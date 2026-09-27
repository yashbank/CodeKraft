import { ReportsScreen } from "@/components/admin/finance/ReportsScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import {
  buildPartnerNameMaps,
  computeStatementPreview,
  mapCustomerCreditRows,
  mapReportResultToDefinition,
  mapStatementExportLogToRow,
} from "@/lib/admin/finance-view";
import { getReportQuery, listLedgerEntriesQuery } from "@/modules/finance/queries";
import { listAuditLogsAction } from "@/modules/audit/queries";
import { listPartnersQuery } from "@/modules/users/queries";
import type { ReportDefinition, ReportKey, StatementPreview } from "@/components/admin/types";
import type { ReportKey as FinanceReportKey } from "@/modules/finance/types";

export const dynamic = "force-dynamic";

const REPORT_META: Record<ReportKey, { title: string; description: string; formula: string }> = {
  revenue_by_period: {
    title: "Revenue by period",
    description: "Net sales posted to the ledger per month (INR reporting currency).",
    formula: "Σ sale − Σ discount − Σ refund_sale, grouped by payment date",
  },
  revenue_by_product: {
    title: "Revenue by product",
    description: "Net revenue per product with order counts.",
    formula: "Σ sale − Σ refund_sale per product",
  },
  revenue_by_partner: {
    title: "Revenue by partner",
    description: "Partner allocations net of refund reversals.",
    formula: "Σ partner_allocation − Σ refund_partner_allocation",
  },
  tax_collected: {
    title: "Tax collected",
    description: "GST collected per month.",
    formula: "Σ tax_collected − Σ refund_tax",
  },
  refunds: {
    title: "Refunds & customer credits",
    description: "Refunds issued and overpayments held as customer credit.",
    formula: "Σ refund_* entries; credits from the customer_credits view",
  },
  outstanding_payouts: {
    title: "Outstanding payouts",
    description: "Partner balances not yet paid out.",
    formula: "partner_balances view",
  },
  profit_by_product: {
    title: "Profit by product",
    description: "Revenue minus expenses recorded against each product.",
    formula: "net revenue − Σ expense per product",
  },
};

const REPORT_ORDER = Object.keys(REPORT_META) as (keyof typeof REPORT_META)[];

/** Current Indian financial year (1 Apr – today). */
function currentFyRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return {
    dateFrom: `${fyStartYear}-04-01`,
    dateTo: now.toISOString().slice(0, 10),
  };
}

export default async function AdminReportsPage() {
  const ctx = await getAdminRequestContext();
  const { dateFrom, dateTo } = currentFyRange();

  const [reportResults, customerCreditsResult, partnersResult] = await Promise.all([
    Promise.all(
      REPORT_ORDER.map((key) =>
        getReportQuery({ report: key as FinanceReportKey, dateFrom, dateTo }, ctx).catch(
          () => ({ ok: false as const }),
        ),
      ),
    ),
    getReportQuery({ report: "customer_credits", dateFrom, dateTo }, ctx).catch(
      () => ({ ok: false as const }),
    ),
    listPartnersQuery({ limit: 200 }, ctx).catch(() => ({ ok: false as const })),
  ]);

  const reports: ReportDefinition[] = REPORT_ORDER.map((key, i) => {
    const result = reportResults[i];
    if (!result || !("data" in result) || !result.ok) {
      return { key, ...REPORT_META[key], tiles: [], series: [], columns: [], rows: [] };
    }
    return mapReportResultToDefinition(result.data, REPORT_META[key]);
  });

  const customerCredits =
    "data" in customerCreditsResult && customerCreditsResult.ok
      ? mapCustomerCreditRows(customerCreditsResult.data)
      : [];

  const partnerViews = "data" in partnersResult && partnersResult.ok ? partnersResult.data.items : [];
  const { byPartnerId: partnerNames } = buildPartnerNameMaps(partnerViews);
  const firstPartner = partnerViews[0];

  // Statement preview defaults to the current calendar month for the first partner in the
  // roster; the form's own partner/period/format controls are not wired to a live re-fetch (no
  // client interactivity was added beyond the real "Generate" call -- see report).
  const now = new Date();
  const periodFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodFromIso = periodFrom.toISOString().slice(0, 10);
  const periodToIso = now.toISOString().slice(0, 10);
  // `dateTo` filters are `lte(createdAt, midnight of that date)` (date-only, not end-of-day), so
  // querying up to *tomorrow* is what actually includes all of today's entries.
  const queryDateToIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let statement: StatementPreview = {
    partner: firstPartner?.displayName ?? "—",
    period: `${periodFromIso} – ${periodToIso}`,
    opening: 0,
    allocations: [],
    refunds: 0,
    expenseShares: 0,
    payouts: 0,
    closing: 0,
  };

  if (firstPartner) {
    const [beforeResult, inRangeResult] = await Promise.all([
      listLedgerEntriesQuery(
        { filters: { partnerId: firstPartner.id, dateTo: periodFromIso }, limit: 500, sort: "seq:desc" },
        ctx,
      ),
      listLedgerEntriesQuery(
        {
          filters: { partnerId: firstPartner.id, dateFrom: periodFromIso, dateTo: queryDateToIso },
          limit: 500,
        },
        ctx,
      ),
    ]);
    const openingBalanceInrMinor = beforeResult.ok
      ? beforeResult.data.items.reduce((s, e) => s + e.amountInrMinor, 0)
      : 0;
    statement = computeStatementPreview({
      partnerName: firstPartner.displayName,
      period: `${periodFromIso} – ${periodToIso}`,
      openingBalanceInrMinor,
      entries: inRangeResult.ok ? inRangeResult.data.items : [],
    });
  }

  const statementHistoryResult = await listAuditLogsAction(
    { filters: { action: "API-FIN-10 statement.exported", subjectType: "partner" }, limit: 50 },
    ctx,
  ).catch(() => ({ ok: false as const }));
  const statementHistory =
    "data" in statementHistoryResult && statementHistoryResult.ok
      ? statementHistoryResult.data.items.map((row) => mapStatementExportLogToRow(row, partnerNames))
      : [];

  return (
    <ReportsScreen
      reports={reports}
      customerCredits={customerCredits}
      partners={partnerViews.map((p) => ({ id: p.id, name: p.displayName }))}
      statement={statement}
      statementHistory={statementHistory}
      isSuperAdmin={ctx.roles.includes("super_admin")}
    />
  );
}
