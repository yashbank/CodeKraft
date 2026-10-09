/**
 * View-model mappers for the admin Finance screens (ledger, allocations, expenses, adjustments,
 * partners & payouts, reports) -- service/module shapes -> `components/admin/finance/*` prop
 * shapes. Kept out of the page components (mapping never lives in a page) and out of the screen
 * components themselves (they stay props-driven), per the phase convention already used by
 * `orders-view.ts` / `customers-view.ts`.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - Actor names (recordedBy / requestedBy / approver / generatedBy) resolve through the partner
 *    roster (`userId -> displayName`) with a short id fallback -- there is no batch admin-user
 *    display-name query wired anywhere in this codebase (`orders-view.ts` documents the same gap
 *    for its audit timeline).
 *  - `AllocationRow.offering` needs `OrderDetail.itemMeta` (only `getOrderAdmin` resolves a
 *    separate product name from the item description); pages that only have
 *    `getOrderAllocation`'s `ItemAllocationView.description` fall back to that same string for
 *    both `product` and `offering`.
 *  - `AllocationRow.ownershipVersion` shows `v<n>` from `ownershipVersion`; there is no
 *    "effective <date>" lookup wired, unlike the fixture's "v2 · effective 1 Aug".
 *  - `PartnerBalance.earnedInr` / `.paidOutInr` / `.history` / `.sparkline` are computed from the
 *    partner's most recent ledger entries (real data, `computePartnerRollup`'s `LEDGER_ROLLUP_LIMIT`
 *    entries per partner) rather than a true unbounded all-time aggregate -- there is no
 *    pre-aggregated "lifetime totals" query. For this app's data volumes that cap should cover
 *    full history; it is a documented approximation, not fabrication.
 *  - `CustomerCreditRow.state` is "open" or "refunded" (from the `customer_credits` view's
 *    `amount_refunded_minor`); "applied" (credit consumed against a later order) isn't tracked by
 *    that view so is never produced here.
 *  - `AdjustmentRow.createdAt` is derived from the approval's `ageHours` (`ApprovalView` has no
 *    exact timestamp field), so it is accurate to the hour, not the second.
 */
import type { Currency } from "@/lib/money";
import type {
  Expense,
  LedgerEntryView,
  OrderAllocationView,
  Payout,
  ReportCell,
  ReportResult,
} from "@/modules/finance/types";
import type { ApprovalView } from "@/modules/approvals/types";
import type { AuditLogRow } from "@/modules/audit/types";
import type { PartnerView } from "@/modules/users/types";
import type { OrderAdminRow } from "@/modules/orders/types";
import type {
  AdjustmentRow,
  AllocationRow,
  CustomerCreditRow,
  ExpenseRow,
  LedgerEntry,
  PartnerBalance,
  PayoutRow,
  ReportDefinition,
  ReportKey,
  StatementHistoryRow,
  StatementPreview,
} from "@/components/admin/types";

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "unknown";
}

/** `partners.id -> displayName` lookup with a short-id fallback (see file header). */
export function partnerLabel(
  partnerId: string | null | undefined,
  partnerNames: ReadonlyMap<string, string>,
): string {
  if (!partnerId) return "Unknown partner";
  return partnerNames.get(partnerId) ?? `Partner ${shortId(partnerId)}`;
}

/** `users.id -> displayName` lookup (via the partner roster) with a short-id fallback. */
export function userLabel(
  userId: string | null | undefined,
  userNames: ReadonlyMap<string, string>,
): string {
  if (!userId) return "System";
  return userNames.get(userId) ?? shortId(userId);
}

export function buildPartnerNameMaps(partners: PartnerView[]): {
  byPartnerId: Map<string, string>;
  byUserId: Map<string, string>;
} {
  return {
    byPartnerId: new Map(partners.map((p) => [p.id, p.displayName])),
    byUserId: new Map(partners.map((p) => [p.userId, p.displayName])),
  };
}

// ---------------------------------------------------------------------------------------------
// Ledger (SCR-ADM-17)
// ---------------------------------------------------------------------------------------------

export function mapLedgerEntryToRow(
  e: LedgerEntryView,
  partnerNames: ReadonlyMap<string, string>,
): LedgerEntry {
  const party =
    e.partyType === "partner"
      ? partnerLabel(e.partnerId, partnerNames)
      : e.partyType === "company"
        ? "Company"
        : e.partyType === "tax_authority"
          ? "Tax authority"
          : e.partyType === "gateway"
            ? "Gateway"
            : e.partyType === "bank"
              ? "Bank"
              : "Customer";
  return {
    seq: e.seq,
    at: e.createdAt,
    type: e.entryType,
    party,
    partyType: e.partyType,
    order: e.links.orderNo ?? undefined,
    amount: e.amount,
    fxRate: e.fxRateToInr,
    amountInr: e.amountInrMinor,
    memo: e.memo ?? "",
    ref: e.links.paymentId ?? e.links.refundId ?? e.links.payoutId ?? undefined,
    createdBy: e.createdBy,
  };
}

export function mapLedgerEntries(
  items: LedgerEntryView[],
  partnerNames: ReadonlyMap<string, string>,
): LedgerEntry[] {
  return items.map((e) => mapLedgerEntryToRow(e, partnerNames));
}

// ---------------------------------------------------------------------------------------------
// Allocations (SCR-ADM-18)
// ---------------------------------------------------------------------------------------------

export interface AllocationSource {
  order: OrderAdminRow;
  allocation: OrderAllocationView;
  /** `orderItemId -> resolved product name`, from `getOrderAdmin`'s `itemMeta` when available. */
  productNames: ReadonlyMap<string, string>;
}

export function mapOrderAllocationToRows(
  source: AllocationSource,
  partnerNames: ReadonlyMap<string, string>,
): AllocationRow[] {
  const { order, allocation } = source;
  const isRefund = order.status === "refunded" || order.status === "partially_refunded";
  return allocation.items.map((item, i) => ({
    id: `${allocation.orderId}-${item.orderItemId}`,
    at: order.createdAt,
    order: allocation.orderNo,
    item: String(i + 1),
    product: source.productNames.get(item.orderItemId) ?? item.description,
    offering: item.description,
    gross: item.gross,
    discount: item.discount,
    tax: item.tax,
    gatewayFee: item.gatewayFee,
    bankCharge: item.bankCharge,
    distributable: item.distributable,
    companyCut: { bps: item.companyCutBps, amount: item.companyCut },
    partners: item.lines.map((l) => ({
      name: partnerLabel(l.partnerId, partnerNames),
      bps: l.shareBps,
      amount: l.amount,
    })),
    ownershipVersion: item.ownershipVersion ? `v${item.ownershipVersion}` : "—",
    isRefund,
  }));
}

// ---------------------------------------------------------------------------------------------
// Expenses (SCR-ADM-20)
// ---------------------------------------------------------------------------------------------

export interface ExpenseLedgerInfo {
  minSeq: number;
  amountInrMinor: number;
}

/** `expenseId -> {minSeq, amountInrMinor}` built from a page of `entryType: ["expense"]` ledger entries. */
export function buildExpenseLedgerIndex(
  entries: LedgerEntryView[],
): Map<string, ExpenseLedgerInfo> {
  const index = new Map<string, ExpenseLedgerInfo>();
  for (const e of entries) {
    const expenseId = e.links.expenseId;
    if (!expenseId) continue;
    const existing = index.get(expenseId);
    if (existing) {
      existing.minSeq = Math.min(existing.minSeq, e.seq);
      existing.amountInrMinor += Math.abs(e.amountInrMinor);
    } else {
      index.set(expenseId, { minSeq: e.seq, amountInrMinor: Math.abs(e.amountInrMinor) });
    }
  }
  return index;
}

export function mapExpenseToRow(
  exp: Expense,
  opts: {
    productNames: ReadonlyMap<string, string>;
    userNames: ReadonlyMap<string, string>;
    ledgerIndex: ReadonlyMap<string, ExpenseLedgerInfo>;
  },
): ExpenseRow {
  const ledger = opts.ledgerIndex.get(exp.id);
  return {
    id: exp.id,
    at: exp.incurredOn,
    description: exp.description ?? exp.category,
    category: exp.category,
    product: exp.productId ? (opts.productNames.get(exp.productId) ?? undefined) : undefined,
    amount: { amountMinor: exp.amountMinor, currency: exp.currency as Currency },
    amountInr: ledger?.amountInrMinor ?? (exp.currency === "INR" ? exp.amountMinor : 0),
    sharedBySplit: exp.sharedBySplit,
    receipt: exp.receiptMediaId ? `receipt-${shortId(exp.receiptMediaId)}` : undefined,
    recordedBy: userLabel(exp.createdBy, opts.userNames),
    ledgerSeq: ledger?.minSeq ?? 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Adjustments (SCR-ADM-21)
// ---------------------------------------------------------------------------------------------

interface AdjustmentPayloadLine {
  partyType: AdjustmentRow["lines"][number]["partyType"];
  partnerId?: string;
  amountMinor: number;
  currency: Currency;
  memo: string;
  orderId?: string;
}
interface AdjustmentPayload {
  lines: AdjustmentPayloadLine[];
  reason: string;
}

export function mapApprovalToAdjustmentRow(
  a: ApprovalView,
  opts: {
    partnerNames: ReadonlyMap<string, string>;
    userNames: ReadonlyMap<string, string>;
    ledgerSeqs?: number[];
  },
): AdjustmentRow {
  const payload = a.payload as unknown as AdjustmentPayload;
  const lastDecision = a.decisions[a.decisions.length - 1];
  // `ApprovalView` has no exact created-at timestamp, only `ageHours` -- see file header.
  const createdAt = new Date(Date.now() - a.ageHours * 3_600_000).toISOString();
  return {
    id: a.id,
    createdAt,
    reason: payload.reason,
    lines: payload.lines.map((l) => ({
      partyType: l.partyType,
      partner:
        l.partyType === "partner" && l.partnerId
          ? partnerLabel(l.partnerId, opts.partnerNames)
          : undefined,
      amount: { amountMinor: l.amountMinor, currency: l.currency },
      memo: l.memo,
      order: l.orderId ? shortId(l.orderId) : undefined,
    })),
    requestedBy: userLabel(a.requestedBy, opts.userNames),
    approver: lastDecision ? userLabel(lastDecision.decidedBy, opts.userNames) : undefined,
    decidedAt: lastDecision?.createdAt,
    status: a.status,
    ledgerSeqs: a.status === "applied" ? opts.ledgerSeqs : undefined,
  };
}

// ---------------------------------------------------------------------------------------------
// Partners & payouts (SCR-ADM-19)
// ---------------------------------------------------------------------------------------------

/** Bounds how much ledger history feeds "earned (all time)" / balance history -- see file header. */
export const LEDGER_ROLLUP_LIMIT = 500;

interface MonthBucket {
  month: string; // "2026-09"
  allocations: number;
  refunds: number;
  expenses: number;
  payouts: number;
}

export interface PartnerRollup {
  earnedInrMinor: number;
  paidOutInrMinor: number;
  history: PartnerBalance["history"];
  sparkline: number[];
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

/** Pure aggregation over a (bounded) page of a partner's ledger entries -- see `LEDGER_ROLLUP_LIMIT`. */
export function computePartnerRollup(
  entries: LedgerEntryView[],
  currentBalanceInrMinor: number,
): PartnerRollup {
  const buckets = new Map<string, MonthBucket>();
  let earnedInrMinor = 0;
  let paidOutInrMinor = 0;

  for (const e of entries) {
    const key = monthKey(e.createdAt);
    const bucket = buckets.get(key) ?? {
      month: key,
      allocations: 0,
      refunds: 0,
      expenses: 0,
      payouts: 0,
    };
    if (e.entryType === "partner_allocation") {
      bucket.allocations += e.amountInrMinor;
      earnedInrMinor += e.amountInrMinor;
    } else if (e.entryType === "refund_partner_allocation") {
      bucket.refunds += e.amountInrMinor;
      earnedInrMinor += e.amountInrMinor;
    } else if (e.entryType === "expense") {
      bucket.expenses += e.amountInrMinor;
    } else if (e.entryType === "payout") {
      bucket.payouts += e.amountInrMinor;
      paidOutInrMinor += Math.abs(e.amountInrMinor);
    }
    buckets.set(key, bucket);
  }

  const monthsDesc = [...buckets.values()].sort((a, b) => (a.month < b.month ? 1 : -1));

  const history: PartnerBalance["history"] = [];
  let running = currentBalanceInrMinor;
  for (const m of monthsDesc.slice(0, 3)) {
    history.push({
      month: MONTH_LABEL.format(new Date(`${m.month}-01T00:00:00Z`)),
      allocations: m.allocations,
      refunds: m.refunds,
      expenses: m.expenses,
      payouts: m.payouts,
      closing: running,
    });
    running -= m.allocations + m.refunds + m.expenses + m.payouts;
  }

  const sparkline = monthsDesc
    .slice(0, 6)
    .reverse()
    .map((m) => Math.abs(m.allocations));

  return {
    earnedInrMinor,
    paidOutInrMinor,
    history,
    sparkline: sparkline.length > 0 ? sparkline : [0],
  };
}

export function mapPartnerBalanceToRow(opts: {
  partner: PartnerView;
  balanceInrMinor: number;
  perCurrency: { currency: Currency; balance: number }[];
  rollup: PartnerRollup;
  pendingPayoutApprovals: number;
}): PartnerBalance {
  const { partner } = opts;
  return {
    id: partner.id,
    name: partner.displayName,
    role: partner.active
      ? `Partner · ${partner.activeShareCount} active product${partner.activeShareCount === 1 ? "" : "s"}`
      : "Partner",
    active: partner.active,
    balanceInr: opts.balanceInrMinor,
    perCurrency: opts.perCurrency.map((c) => ({ amountMinor: c.balance, currency: c.currency })),
    earnedInr: opts.rollup.earnedInrMinor,
    paidOutInr: opts.rollup.paidOutInrMinor,
    pendingPayoutApprovals: opts.pendingPayoutApprovals,
    sparkline: opts.rollup.sparkline,
    history: opts.rollup.history,
  };
}

export function mapAppliedPayoutToRow(
  payout: Payout,
  opts: {
    partnerNames: ReadonlyMap<string, string>;
    userNames: ReadonlyMap<string, string>;
    ledgerSeq?: number;
  },
): PayoutRow {
  return {
    id: payout.id,
    paidOn: payout.paidOn,
    partner: partnerLabel(payout.partnerId, opts.partnerNames),
    amount: { amountMinor: payout.amountMinor, currency: payout.currency as Currency },
    reference: payout.reference,
    note: payout.note ?? undefined,
    recordedBy: userLabel(payout.recordedBy, opts.userNames),
    status: "applied",
    ledgerSeq: opts.ledgerSeq,
  };
}

interface PayoutApprovalPayload {
  partnerId: string;
  amountMinor: number;
  currency: Currency;
  paidOn: string;
  reference: string;
  note?: string;
}

export function mapPayoutApprovalToRow(
  a: ApprovalView,
  opts: { partnerNames: ReadonlyMap<string, string>; userNames: ReadonlyMap<string, string> },
): PayoutRow {
  const payload = a.payload as unknown as PayoutApprovalPayload;
  const lastDecision = a.decisions[a.decisions.length - 1];
  const status: PayoutRow["status"] =
    a.status === "applied" ? "applied" : a.status === "rejected" ? "rejected" : "pending";
  return {
    id: a.id,
    paidOn: payload.paidOn,
    partner: partnerLabel(payload.partnerId, opts.partnerNames),
    amount: { amountMinor: payload.amountMinor, currency: payload.currency },
    reference: payload.reference,
    note: payload.note,
    recordedBy: userLabel(a.requestedBy, opts.userNames),
    approvedBy: lastDecision ? userLabel(lastDecision.decidedBy, opts.userNames) : undefined,
    approvedAt: lastDecision?.createdAt,
    status,
    rejectionReason: status === "rejected" ? (lastDecision?.comment ?? undefined) : undefined,
  };
}

export interface CompanyTotals {
  companyCutInr: number;
  companyExpensesInr: number;
  netInr: number;
}

export function computeCompanyTotals(entries: LedgerEntryView[]): CompanyTotals {
  let companyCutInr = 0;
  let companyExpensesInr = 0;
  for (const e of entries) {
    if (e.entryType === "company_cut") companyCutInr += e.amountInrMinor;
    else if (e.entryType === "expense" && e.partyType === "company") {
      companyExpensesInr += Math.abs(e.amountInrMinor);
    }
  }
  return { companyCutInr, companyExpensesInr, netInr: companyCutInr - companyExpensesInr };
}

// ---------------------------------------------------------------------------------------------
// Reports & statements (SCR-ADM-22)
// ---------------------------------------------------------------------------------------------

function formatCell(
  value: ReportCell | undefined,
  kind: "text" | "money" | "count" | "date",
): string | number {
  if (value === null || value === undefined) return kind === "money" || kind === "count" ? 0 : "—";
  if (kind === "money") return typeof value === "number" ? value / 100 : value;
  return value;
}

function moneyCell(value: ReportCell | undefined): number {
  return typeof value === "number" ? value / 100 : 0;
}

/**
 * Generic `ReportResult` (columns/rows/totals) -> `ReportDefinition` (tiles/series/table) mapper.
 * Works uniformly across all 8 report keys because `getReport` follows a consistent shape:
 * text/id columns first, one or more money/count columns after -- see the heuristics inline.
 */
export function mapReportResultToDefinition(
  result: ReportResult,
  meta: { title: string; description: string; formula: string },
): ReportDefinition {
  const moneyOrCountCols = result.columns.filter((c) => c.kind === "money" || c.kind === "count");
  const tiles = moneyOrCountCols.map((c) => ({
    label: c.label,
    valueInr:
      c.kind === "count" ? Number(result.totals[c.key] ?? 0) : moneyCell(result.totals[c.key]),
  }));

  // Label column: index 1 when it's text/date (skips a leading id column), else index 0.
  const labelCol =
    result.columns[1] && (result.columns[1].kind === "text" || result.columns[1].kind === "date")
      ? result.columns[1]
      : result.columns[0];
  const valueCol = moneyOrCountCols[moneyOrCountCols.length - 1];
  const series = valueCol
    ? result.rows.map((row) => ({
        label: String((labelCol && row[labelCol.key]) ?? ""),
        value:
          valueCol.kind === "count" ? Number(row[valueCol.key] ?? 0) : moneyCell(row[valueCol.key]),
      }))
    : [];

  const columns = result.columns.map((c) => c.label);
  const rows = result.rows.map((row) => result.columns.map((c) => formatCell(row[c.key], c.kind)));
  const totals: Array<string | number> = result.columns.map((c, i) =>
    i === 0 ? "Total" : formatCell(result.totals[c.key], c.kind),
  );

  return {
    key: result.report as ReportKey,
    title: meta.title,
    description: meta.description,
    formula: meta.formula,
    tiles,
    series,
    columns,
    rows,
    totals,
  };
}

interface CustomerCreditReportRow {
  orderNo: string;
  paymentId: string;
  creditInrMinor: number;
  amountRefundedMinor: number;
}

export function mapCustomerCreditRows(result: ReportResult): CustomerCreditRow[] {
  return result.rows.map((row) => {
    const r = row as unknown as CustomerCreditReportRow;
    return {
      order: r.orderNo,
      payment: r.paymentId,
      credit: { amountMinor: Number(r.creditInrMinor) || 0, currency: "INR" },
      state: Number(r.amountRefundedMinor) > 0 ? "refunded" : "open",
    };
  });
}

export function computeStatementPreview(opts: {
  partnerName: string;
  period: string;
  openingBalanceInrMinor: number;
  entries: LedgerEntryView[];
}): StatementPreview {
  const allocations: { order: string; amount: number }[] = [];
  let refunds = 0;
  let expenseShares = 0;
  let payouts = 0;
  let periodSum = 0;
  for (const e of opts.entries) {
    periodSum += e.amountInrMinor;
    if (e.entryType === "partner_allocation") {
      allocations.push({
        order: e.links.orderNo ?? shortId(e.links.orderId),
        amount: e.amountInrMinor,
      });
    } else if (e.entryType === "refund_partner_allocation") {
      refunds += e.amountInrMinor;
    } else if (e.entryType === "expense") {
      expenseShares += e.amountInrMinor;
    } else if (e.entryType === "payout") {
      payouts += e.amountInrMinor;
    }
  }
  return {
    partner: opts.partnerName,
    period: opts.period,
    opening: opts.openingBalanceInrMinor,
    allocations,
    refunds,
    expenseShares,
    payouts,
    closing: opts.openingBalanceInrMinor + periodSum,
  };
}

export function mapStatementExportLogToRow(
  row: AuditLogRow,
  partnerNames: ReadonlyMap<string, string>,
): StatementHistoryRow {
  const after = (row.after ?? {}) as {
    partnerId?: string;
    dateFrom?: string;
    dateTo?: string;
    format?: string;
  };
  return {
    id: row.id,
    partner: after.partnerId ? partnerLabel(after.partnerId, partnerNames) : row.subject.id,
    period: after.dateFrom && after.dateTo ? `${after.dateFrom} – ${after.dateTo}` : "—",
    format: after.format === "csv" ? "CSV" : "PDF",
    generatedBy: row.actorRole ?? "admin",
    generatedAt: row.createdAt,
  };
}
