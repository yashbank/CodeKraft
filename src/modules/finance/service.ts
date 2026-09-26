/**
 * `finance` service implementation (docs/06 §2.6 API-FIN-01..11, master plan §5, PHASE-04).
 */
import type { DbOrTx, TxCtx } from "@/lib/db";
import type { RequestContext } from "@/lib/authz/context";
import type { ListResult } from "@/modules/_shared/zod";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { FinanceService } from "./contracts";
import { computeAllocation, spreadDeduction } from "./allocation";
import { postOrderPaid } from "./posting";
import { postRefund } from "./refunds";
import { getOrderAllocation, listLedgerEntries } from "./entries";
import { getPartnerBalances } from "./balances";
import { applyPayout, listPayouts, postPayout, recordPayout } from "./payouts";
import { listExpenses, postExpense, recordExpense } from "./expenses";
import { applyAdjustment, postAdjustment, proposeAdjustment } from "./adjustments";
import { getReport } from "./reports";
import { exportStatement } from "./statements";
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

export class DefaultFinanceService implements FinanceService {
  private readonly fallback = createNotImplementedFinanceService();

  readonly computeAllocation: ComputeAllocation = computeAllocation;
  readonly spreadDeduction: SpreadDeduction = spreadDeduction;

  // -- master plan §5 posting contract ------------------------------------------------------------

  async postOrderPaid(orderId: string, tx: TxCtx): Promise<PostOrderPaidResult> {
    return await postOrderPaid(orderId, tx);
  }

  async postRefund(refundId: string, tx: TxCtx): Promise<PostEntriesResult> {
    return await postRefund(refundId, tx);
  }

  async postPayout(payoutId: string, tx: TxCtx): Promise<PostEntriesResult> {
    return await postPayout(payoutId, tx);
  }

  async postExpense(expenseId: string, tx: TxCtx): Promise<PostEntriesResult> {
    return await postExpense(expenseId, tx);
  }

  async postAdjustment(approvalRequestId: string, tx: TxCtx): Promise<PostEntriesResult> {
    return await postAdjustment(approvalRequestId, tx);
  }

  // -- queries ------------------------------------------------------------------------------------

  async listLedgerEntries(
    ctx: RequestContext,
    input: ListLedgerEntriesInput,
  ): Promise<LedgerListResult> {
    return await listLedgerEntries(ctx, input);
  }

  async getOrderAllocation(
    ctx: RequestContext,
    input: GetOrderAllocationInput,
  ): Promise<OrderAllocationView> {
    return await getOrderAllocation(ctx, input);
  }

  async getPartnerBalances(
    ctx: RequestContext,
    input: GetPartnerBalancesInput,
  ): Promise<PartnerBalance[]> {
    return await getPartnerBalances(ctx, input);
  }

  async getReport(ctx: RequestContext, input: GetReportInput): Promise<ReportResult> {
    return await getReport(ctx, input);
  }

  async listPayouts(ctx: RequestContext, input: ListPayoutsInput): Promise<ListResult<Payout>> {
    return await listPayouts(ctx, input);
  }

  async listExpenses(ctx: RequestContext, input: ListExpensesInput): Promise<ListResult<Expense>> {
    return await listExpenses(ctx, input);
  }

  // -- actions ------------------------------------------------------------------------------------

  async recordPayout(
    ctx: RequestContext,
    input: RecordPayoutInput,
    tx?: TxCtx,
  ): Promise<{ approvalRequestId: string }> {
    return await recordPayout(ctx, input, tx);
  }

  async applyPayout(
    payload: PayoutRecordPayload,
    approvalRequestId: string,
    tx: TxCtx,
  ): Promise<{ payoutId: string } & PostEntriesResult> {
    return await applyPayout(payload, approvalRequestId, tx);
  }

  async recordExpense(
    ctx: RequestContext,
    input: RecordExpenseInput,
    tx?: TxCtx,
  ): Promise<RecordExpenseResult> {
    return await recordExpense(ctx, input, tx);
  }

  async proposeAdjustment(
    ctx: RequestContext,
    input: ProposeAdjustmentInput,
    tx?: TxCtx,
  ): Promise<{ approvalRequestId: string }> {
    return await proposeAdjustment(ctx, input, tx);
  }

  async applyAdjustment(
    payload: LedgerAdjustmentPayload,
    approvalRequestId: string,
    tx: TxCtx,
  ): Promise<PostEntriesResult> {
    return await applyAdjustment(payload, approvalRequestId, tx);
  }

  async exportStatement(
    ctx: RequestContext,
    input: ExportStatementInput,
  ): Promise<StatementExport> {
    return await exportStatement(ctx, input);
  }
}

export const financeService: FinanceService = new DefaultFinanceService();

/** Preserved for freeze and contract tests (PHASE-02 P2.8). */
export function createNotImplementedFinanceService(): FinanceService {
  return createNotImplemented<FinanceService>("finance", "P4", {
    postOrderPaid: "async",
    postRefund: "async",
    postPayout: "async",
    postExpense: "async",
    postAdjustment: "async",
    computeAllocation: "sync",
    spreadDeduction: "sync",
    listLedgerEntries: "async",
    getOrderAllocation: "async",
    getPartnerBalances: "async",
    getReport: "async",
    listPayouts: "async",
    listExpenses: "async",
    recordPayout: "async",
    applyPayout: "async",
    recordExpense: "async",
    proposeAdjustment: "async",
    applyAdjustment: "async",
    exportStatement: "async",
  });
}
