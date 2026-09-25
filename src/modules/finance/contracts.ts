/**
 * Finance service contract (docs/06 §2.6 API-FIN-01..11; §4.2 posting; docs/04 §7.2).
 *
 * Master plan §5 — frozen posting signatures (never change without an ADR):
 *   postOrderPaid(orderId, tx) · postRefund(refundId, tx) · postPayout(payoutId, tx)
 *   postExpense(expenseId, tx) · postAdjustment(approvalRequestId, tx)
 * Each posts inside the caller's transaction and derives `created_by` from the subject row
 * (payment.confirmed_by, refund.executed_by, payout.recorded_by, expense.created_by, the final
 * approval decision). Ledger rows are append-only (MASTER_SPEC §4.1); FX rate on every entry (D-515).
 */
import type { TxCtx } from "@/lib/db";
import type { RequestContext } from "@/lib/authz/context";
import type { ListResult } from "@/modules/_shared/zod";
import type {
  ComputeAllocation,
  ExportStatementInput,
  Expense,
  GetOrderAllocationInput,
  GetPartnerBalancesInput,
  GetReportInput,
  LedgerAdjustmentPayload,
  LedgerListResult,
  ListExpensesInput,
  ListLedgerEntriesInput,
  ListPayoutsInput,
  OrderAllocationView,
  PartnerBalance,
  Payout,
  PayoutRecordPayload,
  PostEntriesResult,
  PostOrderPaidResult,
  ProposeAdjustmentInput,
  RecordExpenseInput,
  RecordExpenseResult,
  RecordPayoutInput,
  ReportResult,
  SpreadDeduction,
  StatementExport,
} from "./types";

export interface FinanceService {
  // -- master plan §5 posting contract ------------------------------------------------------------

  /**
   * Post a paid order (docs/06 §4.2, §5.1 step 5): per item `sale`, `discount`, `tax_collected`,
   * `gateway_fee`, `bank_charge`, `company_cut`, `partner_allocation` ×n + an `allocations` row.
   * Product lines use `order_items.ownership_id` re-validated as the version active at payment
   * time (updated before posting if superseded — the only permitted update on that column);
   * project lines use `split_snapshot`. Overpayment is excluded from gross.
   */
  postOrderPaid(orderId: string, tx: TxCtx): Promise<PostOrderPaidResult>;

  /**
   * Proportional `refund_*` reversal (`original × refundAmount / gross`, largest-remainder) of
   * sale, discount, tax, company cut and each partner allocation; fees and bank charges are
   * never reversed (MASTER_SPEC §7 "Refund reversal scope").
   */
  postRefund(refundId: string, tx: TxCtx): Promise<PostEntriesResult>;

  /** `payout` entry, `party_type='partner'`, negative, FX at `paid_on` (API-FIN-05). */
  postPayout(payoutId: string, tx: TxCtx): Promise<PostEntriesResult>;

  /** `expense` entries: per partner by the ownership active on `incurred_on` + company line, or one company line (API-FIN-06). */
  postExpense(expenseId: string, tx: TxCtx): Promise<PostEntriesResult>;

  /** `adjustment` entries from the applied `ledger.adjustment` payload, `approval_request_id` set (API-FIN-08). */
  postAdjustment(approvalRequestId: string, tx: TxCtx): Promise<PostEntriesResult>;

  /** Pure §4.2 per-item computation (see `computeAllocationReference`). */
  readonly computeAllocation: ComputeAllocation;
  /** Pure pro-rata spread of order-level deductions across items. */
  readonly spreadDeduction: SpreadDeduction;

  // -- queries ------------------------------------------------------------------------------------

  /** API-FIN-01 `listLedgerEntries` — `finance.ledger.read` (`read_all` for other partners' lines). */
  listLedgerEntries(ctx: RequestContext, input: ListLedgerEntriesInput): Promise<LedgerListResult>;
  /** API-FIN-02 `getOrderAllocation`. */
  getOrderAllocation(
    ctx: RequestContext,
    input: GetOrderAllocationInput,
  ): Promise<OrderAllocationView>;
  /** API-FIN-03 `getPartnerBalances` — `FORBIDDEN` for another partner without `read_all`. */
  getPartnerBalances(
    ctx: RequestContext,
    input: GetPartnerBalancesInput,
  ): Promise<PartnerBalance[]>;
  /** API-FIN-09 `getReport` — `finance.reports.read`. */
  getReport(ctx: RequestContext, input: GetReportInput): Promise<ReportResult>;
  /** API-FIN-11 `listPayouts`. */
  listPayouts(ctx: RequestContext, input: ListPayoutsInput): Promise<ListResult<Payout>>;
  /** API-FIN-11 `listExpenses`. */
  listExpenses(ctx: RequestContext, input: ListExpensesInput): Promise<ListResult<Expense>>;

  // -- actions ------------------------------------------------------------------------------------

  /** API-FIN-04 `recordPayout` — `VALIDATION` when amount > balance (no override); creates `payout.record`. */
  recordPayout(
    ctx: RequestContext,
    input: RecordPayoutInput,
    tx?: TxCtx,
  ): Promise<{ approvalRequestId: string }>;
  /** API-FIN-05 `applyPayout` (internal, apply handler): insert immutable `payouts` row + `postPayout`. */
  applyPayout(
    payload: PayoutRecordPayload,
    approvalRequestId: string,
    tx: TxCtx,
  ): Promise<{ payoutId: string } & PostEntriesResult>;
  /** API-FIN-06 `recordExpense` — `finance.expense.write`; inserts `expenses` + `postExpense`. */
  recordExpense(
    ctx: RequestContext,
    input: RecordExpenseInput,
    tx?: TxCtx,
  ): Promise<RecordExpenseResult>;
  /** API-FIN-07 `proposeAdjustment` — creates `ledger.adjustment`. */
  proposeAdjustment(
    ctx: RequestContext,
    input: ProposeAdjustmentInput,
    tx?: TxCtx,
  ): Promise<{ approvalRequestId: string }>;
  /** API-FIN-08 `applyAdjustment` (internal, apply handler) → `postAdjustment`. */
  applyAdjustment(
    payload: LedgerAdjustmentPayload,
    approvalRequestId: string,
    tx: TxCtx,
  ): Promise<PostEntriesResult>;
  /** API-FIN-10 `exportStatement` — `finance.statements.export`, own statement for `admin`; audited. */
  exportStatement(ctx: RequestContext, input: ExportStatementInput): Promise<StatementExport>;
}

/** Master plan §5 method names, for the P2.8 freeze / fixture test. */
export const FINANCE_POSTING_METHODS = [
  "postOrderPaid",
  "postRefund",
  "postPayout",
  "postExpense",
  "postAdjustment",
] as const satisfies readonly (keyof FinanceService)[];
