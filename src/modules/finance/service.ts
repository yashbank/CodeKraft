/**
 * `finance` service (PHASE-04 P4.1, P4.8 finance side, P4.9, P4.10, P4.11; docs/06 §2.6
 * API-FIN-01..11, §4.2 posting formula, §5.1 step 5, §5.2 step 3; MASTER_SPEC §4.1, §4.8, §7).
 *
 * `createFinanceService(deps)` builds the frozen `FinanceService` contract over the ports in
 * `deps.ts`; `financeService` is the process-wide instance. Posting methods run inside the
 * caller's transaction and are idempotent per subject row (a second call is a no-op returning the
 * rows already posted). Ledger rows are append-only; corrections are `adjustment` entries.
 */
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { ApplyHandlerRegistry } from "@/modules/approvals/contracts";
import type { AuditActor } from "@/modules/audit/types";
import type { OwnershipVersionView } from "@/modules/ownership/types";
import { type DbOrTx, type TxCtx, type TxRunner, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { type Currency, type Money, assertCurrency } from "@/lib/money";
import { type RequestContext, can, ledgerScope } from "@/lib/authz";
import type { ListResult } from "@/modules/_shared/zod";
import { approvalDecisions, approvalRequests } from "../../../drizzle/schema/approvals";
import { products } from "../../../drizzle/schema/catalog";
import { orderItems, orders, payments, refunds } from "../../../drizzle/schema/commerce";
import {
  type AllocationLine,
  type EntryType,
  type Expense,
  type Payout,
  allocations,
  expenses,
  ledgerEntries,
  payouts,
} from "../../../drizzle/schema/finance";
import { productOwnershipLines } from "../../../drizzle/schema/ownership";
import { partners } from "../../../drizzle/schema/users-ext";
import { type ItemReversed, computeAllocation, spreadDeduction } from "./allocation";
import type { FinanceService } from "./contracts";
import { type FinanceDeps, lazyFinanceDeps } from "./deps";
import { type PlannedEntry, planExpensePosting, planOrderPosting, planRefundPosting } from "./posting";
import { buildReport } from "./reports";
import {
  dateColumn,
  decodeCursor,
  encodeCursor,
  intFromSql,
  istRange,
  parseSort,
  timestampColumn,
} from "./sql";
import { buildStatement, renderStatementCsv, renderStatementPdf } from "./statements";
import {
  type ExportStatementInput,
  type GetOrderAllocationInput,
  type GetPartnerBalancesInput,
  type GetReportInput,
  type ItemAllocationView,
  type LedgerAdjustmentPayload,
  type LedgerEntryView,
  type LedgerListResult,
  type ListExpensesInput,
  type ListLedgerEntriesInput,
  type ListPayoutsInput,
  type OrderAllocationView,
  type PartnerBalance,
  type PayoutRecordPayload,
  type PostEntriesResult,
  type PostOrderPaidResult,
  type ProposeAdjustmentInput,
  type RecordExpenseInput,
  type RecordExpenseResult,
  type RecordPayoutInput,
  type ReportResult,
  type StatementExport,
  ORDER_PAID_ENTRY_TYPES,
} from "./types";

export type { FinanceDeps } from "./deps";

const SYSTEM_ACTOR = (requestId?: string): AuditActor => ({
  kind: "system",
  name: "system",
  ...(requestId === undefined ? {} : { requestId }),
});

type LedgerRow = typeof ledgerEntries.$inferSelect;

/** Rows of `VIEW partner_balances` (drizzle/custom/views.sql). */
export interface PartnerBalanceRow {
  partnerId: string;
  currency: Currency;
  allocated: number;
  refunded: number;
  expenses: number;
  paidOut: number;
  adjusted: number;
  balance: number;
  balanceInrMinor: number;
}

function toView(row: LedgerRow, orderNo: string | null): LedgerEntryView {
  return {
    entryId: row.id,
    seq: row.seq,
    entryType: row.entryType,
    partyType: row.partyType,
    partnerId: row.partnerId,
    amount: { amountMinor: row.amountMinor, currency: assertCurrency(row.currency) },
    amountInrMinor: row.amountInrMinor,
    fxRateToInr: row.fxRateToInr,
    memo: row.memo,
    createdAt: timestampColumn(row.createdAt).toISOString(),
    createdBy: row.createdBy,
    links: {
      orderId: row.orderId,
      orderNo,
      orderItemId: row.orderItemId,
      paymentId: row.paymentId,
      refundId: row.refundId,
      payoutId: row.payoutId,
      expenseId: row.expenseId,
      approvalRequestId: row.approvalRequestId,
    },
  };
}

export function createFinanceService(deps: FinanceDeps): FinanceService {
  const runner = (): TxRunner => deps.db as unknown as TxRunner;

  // -- shared helpers ------------------------------------------------------------------------

  async function insertEntries(
    planned: readonly PlannedEntry[],
    createdBy: string,
    createdAt: Date,
    tx: TxCtx,
  ): Promise<string[]> {
    if (planned.length === 0) return [];
    const rows = await tx
      .insert(ledgerEntries)
      .values(planned.map((p) => ({ ...p, createdBy, createdAt })))
      .returning({ id: ledgerEntries.id });
    return rows.map((r) => r.id);
  }

  /** Product ids the caller's partner holds (or held) a share in — the `admin` ledger scope. */
  async function ownProductIds(partnerId: string, db: DbOrTx): Promise<string[]> {
    const rows = await db
      .selectDistinct({ productId: sql<string>`po.product_id` })
      .from(productOwnershipLines)
      .innerJoin(
        sql`product_ownerships po`,
        sql`po.id = ${productOwnershipLines.ownershipId}`,
      )
      .where(eq(productOwnershipLines.partnerId, partnerId));
    return rows.map((r) => r.productId);
  }

  /** `all`, or the partner id the caller is confined to (D-512). */
  function scopeOf(ctx: RequestContext): "all" | string {
    if (can(ctx, "finance.ledger.read_all")) return "all";
    const scope = ledgerScope(ctx);
    return scope === "all" ? "all" : scope.partnerId;
  }

  async function finalDecider(approvalRequestId: string, tx: DbOrTx): Promise<string> {
    const [approve] = await tx
      .select({ decidedBy: approvalDecisions.decidedBy })
      .from(approvalDecisions)
      .where(
        and(
          eq(approvalDecisions.requestId, approvalRequestId),
          eq(approvalDecisions.decision, "approve"),
        ),
      )
      .orderBy(desc(approvalDecisions.createdAt))
      .limit(1);
    if (approve !== undefined) return approve.decidedBy;
    const [req] = await tx
      .select({ requestedBy: approvalRequests.requestedBy })
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalRequestId))
      .limit(1);
    if (req === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Approval request not found.");
    return req.requestedBy;
  }

  async function balanceRows(
    db: DbOrTx,
    filter: { partnerId?: string; currency?: Currency },
  ): Promise<PartnerBalanceRow[]> {
    const conditions = [sql`true`];
    if (filter.partnerId !== undefined) conditions.push(sql`partner_id = ${filter.partnerId}`);
    if (filter.currency !== undefined) conditions.push(sql`currency = ${filter.currency}`);
    const rows = (await db.execute(sql`
      SELECT partner_id, currency, allocated_minor, refunded_minor, expenses_minor, paid_out_minor,
             adjusted_minor, balance_minor, balance_inr_minor
      FROM partner_balances
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY partner_id, currency
    `)) as unknown as Record<string, unknown>[];
    return rows.map((r) => ({
      partnerId: r["partner_id"] as string,
      currency: assertCurrency(String(r["currency"]).trim()),
      allocated: intFromSql(r["allocated_minor"]),
      refunded: intFromSql(r["refunded_minor"]),
      expenses: intFromSql(r["expenses_minor"]),
      paidOut: intFromSql(r["paid_out_minor"]),
      adjusted: intFromSql(r["adjusted_minor"]),
      balance: intFromSql(r["balance_minor"]),
      balanceInrMinor: intFromSql(r["balance_inr_minor"]),
    }));
  }

  async function partnerBalanceIn(partnerId: string, currency: Currency, db: DbOrTx) {
    const [row] = await balanceRows(db, { partnerId, currency });
    return row?.balance ?? 0;
  }

  async function requirePartner(partnerId: string, db: DbOrTx) {
    const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
    if (partner === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Partner not found.");
    return partner;
  }

  // -- postOrderPaid -------------------------------------------------------------------------

  async function postOrderPaid(orderId: string, tx: TxCtx): Promise<PostOrderPaidResult> {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (order === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), inArray(payments.status, ["confirmed", "refunded"])))
      .orderBy(desc(payments.confirmedAt))
      .limit(1);
    if (payment === undefined) {
      throw new AppError(ErrorCode.STATE_INVALID, "Order has no confirmed payment to post.");
    }

    // Idempotent: the payment was posted already → return what exists (docs/06 §1.5).
    const existing = await tx
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.paymentId, payment.id), inArray(ledgerEntries.entryType, [...ORDER_PAID_ENTRY_TYPES])))
      .orderBy(asc(ledgerEntries.seq));
    if (existing.length > 0) {
      const items = await tx
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));
      const allocRows = await tx
        .select({ id: allocations.id })
        .from(allocations)
        .where(inArray(allocations.orderItemId, items.map((i) => i.id)));
      return {
        entryIds: existing.map((e) => e.id),
        allocationIds: allocRows.map((a) => a.id),
        entryCount: 0,
      };
    }

    const createdBy = payment.confirmedBy ?? order.createdBy;
    if (createdBy === null) {
      throw new AppError(ErrorCode.STATE_INVALID, "Confirmed payment has no confirming admin.");
    }
    const paidAt = timestampColumn(order.paidAt ?? payment.confirmedAt ?? deps.now());
    const currency = assertCurrency(order.currency);
    const fxRateToInr = await deps.fx.rateToInr(currency, paidAt, tx);

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.createdAt), asc(orderItems.id));
    if (items.length === 0) {
      throw new AppError(ErrorCode.STATE_INVALID, "Order has no items to post.");
    }

    // Project orders: every line carries an approved `split_snapshot` (MASTER_SPEC §7).
    if (order.type === "project") {
      if (order.splitApprovalRequestId === null) {
        throw new AppError(ErrorCode.STATE_INVALID, "Project order split is not approved.");
      }
      const [req] = await tx
        .select({ status: approvalRequests.status, type: approvalRequests.type })
        .from(approvalRequests)
        .where(eq(approvalRequests.id, order.splitApprovalRequestId))
        .limit(1);
      if (req === undefined || req.type !== "project_order.split" || req.status !== "applied") {
        throw new AppError(ErrorCode.STATE_INVALID, "Project order split is not approved.");
      }
    }

    const postingItems = [];
    for (const item of items) {
      let split: { ownershipId: string | null; companyCutBps: number; lines: { partnerId: string; shareBps: number }[] };
      if (item.productId === null || (order.type === "project" && item.splitSnapshot !== null)) {
        const snap = item.splitSnapshot;
        if (snap === null) {
          throw new AppError(ErrorCode.STATE_INVALID, `Order line ${item.id} has no approved split.`);
        }
        split = {
          ownershipId: null,
          companyCutBps: snap.company_cut_bps,
          lines: snap.lines.map((l) => ({ partnerId: l.partner_id, shareBps: l.share_bps })),
        };
      } else {
        const version = await resolveOwnership(item.productId, item.ownershipId, paidAt, tx);
        if (version.id !== item.ownershipId) {
          // The only permitted update on this column (docs/06 §4.2, trigger `ownership_frozen`).
          await tx.update(orderItems).set({ ownershipId: version.id }).where(eq(orderItems.id, item.id));
        }
        split = {
          ownershipId: version.id,
          companyCutBps: version.companyCutBps,
          lines: version.lines.map((l) => ({ partnerId: l.partnerId, shareBps: l.shareBps })),
        };
      }
      postingItems.push({
        orderItemId: item.id,
        description: item.description,
        grossMinor: item.unitMinor * item.quantity,
        discountMinor: item.discountMinor,
        taxMinor: item.taxMinor,
        totalMinor: item.totalMinor,
        ...split,
      });
    }

    let plan;
    try {
      plan = planOrderPosting({
        orderId,
        paymentId: payment.id,
        currency,
        fxRateToInr,
        gatewayFeeMinor: gatewayFeeOf(payment.providerPayload),
        bankShortfallMinor: payment.bankShortfallMinor ?? 0,
        items: postingItems,
      });
    } catch (err) {
      throw new AppError(ErrorCode.STATE_INVALID, "Order cannot be allocated.", { cause: err });
    }

    const entryIds = await insertEntries(plan.entries, createdBy, paidAt, tx);
    const allocRows = await tx
      .insert(allocations)
      .values(plan.allocations.map((a) => ({ ...a, createdAt: paidAt })))
      .returning({ id: allocations.id });
    return { entryIds, allocationIds: allocRows.map((a) => a.id), entryCount: entryIds.length };
  }

  /** Ownership version active at `paidAt`; falls back to the captured version (BR-05, FI-10). */
  async function resolveOwnership(
    productId: string,
    capturedId: string | null,
    paidAt: Date,
    tx: TxCtx,
  ): Promise<OwnershipVersionView> {
    const active = await deps.ownership.getActiveAt(productId, paidAt, tx);
    if (active !== null && active.lines.length > 0) return active;
    if (capturedId !== null) {
      const captured = await capturedOwnership(capturedId, tx);
      if (captured !== null) return captured;
    }
    throw new AppError(ErrorCode.STATE_INVALID, "Product line has no ownership version to allocate.");
  }

  async function capturedOwnership(ownershipId: string, tx: TxCtx): Promise<OwnershipVersionView | null> {
    const rows = await tx.execute(sql`
      SELECT po.id, po.product_id, po.version, po.status, po.company_cut_bps, po.effective_from,
             po.approval_request_id, po.created_by, po.created_at,
             l.partner_id, l.share_bps, p.display_name
      FROM product_ownerships po
      JOIN product_ownership_lines l ON l.ownership_id = po.id
      JOIN partners p ON p.id = l.partner_id
      WHERE po.id = ${ownershipId}
      ORDER BY l.created_at, l.partner_id
    `) as unknown as Record<string, unknown>[];
    const first = rows[0];
    if (first === undefined) return null;
    return {
      id: first["id"] as string,
      productId: first["product_id"] as string,
      version: intFromSql(first["version"]),
      status: first["status"] as OwnershipVersionView["status"],
      companyCutBps: intFromSql(first["company_cut_bps"]),
      lines: rows.map((r) => ({
        partnerId: r["partner_id"] as string,
        displayName: String(r["display_name"]),
        shareBps: intFromSql(r["share_bps"]),
      })),
      effectiveFrom: first["effective_from"] === null ? null : timestampColumn(first["effective_from"] as string | Date).toISOString(),
      approvalRequestId: (first["approval_request_id"] as string | null) ?? null,
      createdBy: { id: first["created_by"] as string, name: "" },
      createdAt: timestampColumn(first["created_at"] as string | Date).toISOString(),
    };
  }

  // -- postRefund ----------------------------------------------------------------------------

  async function postRefund(refundId: string, tx: TxCtx): Promise<PostEntriesResult> {
    const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).limit(1);
    if (refund === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Refund not found.");
    const existing = await tx
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.refundId, refundId))
      .orderBy(asc(ledgerEntries.seq));
    if (existing.length > 0) return { entryIds: existing.map((e) => e.id), entryCount: 0 };

    const [order] = await tx.select().from(orders).where(eq(orders.id, refund.orderId)).limit(1);
    if (order === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
    const currency = assertCurrency(order.currency);
    if (refund.currency.trim() !== currency) {
      throw new AppError(ErrorCode.STATE_INVALID, "Refund currency differs from the order.");
    }
    const createdBy =
      refund.executedBy ??
      (refund.approvalRequestId === null ? null : await finalDecider(refund.approvalRequestId, tx));
    if (createdBy === null) {
      throw new AppError(ErrorCode.STATE_INVALID, "Refund has no executing admin.");
    }
    const executedAt = timestampColumn(refund.executedAt ?? deps.now());
    const fxRateToInr = await deps.fx.rateToInr(currency, executedAt, tx);

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.createdAt), asc(orderItems.id));
    const allocRows = await tx
      .select()
      .from(allocations)
      .where(inArray(allocations.orderItemId, items.map((i) => i.id)));
    const allocByItem = new Map(allocRows.map((a) => [a.orderItemId, a]));
    if (allocByItem.size !== items.length) {
      throw new AppError(ErrorCode.STATE_INVALID, "Order was never posted; nothing to reverse.");
    }
    const orderEntries = await tx
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, order.id));

    // Refunds already posted on this order (excluding this one).
    const prev = await tx
      .select({ total: sql<string>`coalesce(sum(${refunds.amountMinor}), 0)` })
      .from(refunds)
      .where(
        and(
          eq(refunds.orderId, order.id),
          sql`${refunds.id} <> ${refundId}`,
          sql`exists (select 1 from ledger_entries le where le.refund_id = ${refunds.id})`,
        ),
      );
    const previouslyRefundedMinor = intFromSql(prev[0]?.total);

    const sumOf = (itemId: string, type: EntryType, partnerId?: string) =>
      orderEntries
        .filter(
          (e) =>
            e.orderItemId === itemId &&
            e.entryType === type &&
            (partnerId === undefined || e.partnerId === partnerId),
        )
        .reduce((acc, e) => acc + e.amountMinor, 0);

    const refundItems = items.map((item) => {
      const alloc = allocByItem.get(item.id) as typeof allocations.$inferSelect;
      const lines: AllocationLine[] = alloc.lines;
      const already: ItemReversed = {
        saleMinor: -sumOf(item.id, "refund_sale"),
        discountMinor: sumOf(item.id, "refund_discount"),
        taxMinor: -sumOf(item.id, "refund_tax"),
        companyMinor: -sumOf(item.id, "refund_company_cut"),
        lines: Object.fromEntries(
          lines.map((l) => [l.partner_id, -sumOf(item.id, "refund_partner_allocation", l.partner_id)]),
        ),
      };
      return {
        orderItemId: item.id,
        description: item.description,
        totalMinor: item.totalMinor,
        saleMinor: sumOf(item.id, "sale"),
        discountMinor: -sumOf(item.id, "discount"),
        taxMinor: sumOf(item.id, "tax_collected"),
        companyMinor: alloc.companyMinor,
        lines,
        already,
      };
    });

    let planned: PlannedEntry[];
    try {
      planned = planRefundPosting({
        orderId: order.id,
        refundId,
        currency,
        fxRateToInr,
        previouslyRefundedMinor,
        refundMinor: refund.amountMinor,
        items: refundItems,
      });
    } catch (err) {
      throw new AppError(ErrorCode.STATE_INVALID, "Refund exceeds what can be reversed.", { cause: err });
    }
    const entryIds = await insertEntries(planned, createdBy, executedAt, tx);
    return { entryIds, entryCount: entryIds.length };
  }

  // -- payouts -------------------------------------------------------------------------------

  async function postPayout(payoutId: string, tx: TxCtx): Promise<PostEntriesResult> {
    const [payout] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
    if (payout === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Payout not found.");
    const existing = await tx
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.payoutId, payoutId));
    if (existing.length > 0) return { entryIds: existing.map((e) => e.id), entryCount: 0 };
    const createdBy =
      payout.recordedBy ??
      (payout.approvalRequestId === null ? null : await finalDecider(payout.approvalRequestId, tx));
    if (createdBy === null) throw new AppError(ErrorCode.STATE_INVALID, "Payout has no recording admin.");
    const currency = assertCurrency(payout.currency.trim());
    const paidOn = dateColumn(payout.paidOn);
    const fxRateToInr = await deps.fx.rateToInr(currency, istRange(paidOn, paidOn).from, tx);
    const entry: PlannedEntry = {
      entryType: "payout",
      partyType: "partner",
      partnerId: payout.partnerId,
      amountMinor: -payout.amountMinor,
      currency,
      fxRateToInr,
      amountInrMinor: 0,
      memo: `Payout ${payout.reference}`,
      orderId: null,
      orderItemId: null,
      paymentId: null,
      refundId: null,
      payoutId,
      expenseId: null,
      approvalRequestId: payout.approvalRequestId,
    };
    const { toInrMinor } = await import("@/lib/money");
    entry.amountInrMinor = toInrMinor(entry.amountMinor, fxRateToInr);
    const entryIds = await insertEntries([entry], createdBy, deps.now(), tx);
    return { entryIds, entryCount: entryIds.length };
  }

  async function recordPayout(
    ctx: RequestContext,
    input: RecordPayoutInput,
    tx?: TxCtx,
  ): Promise<{ approvalRequestId: string }> {
    return withTx(
      async (t) => {
        const partner = await requirePartner(input.partnerId, t);
        if (!partner.active) throw new AppError(ErrorCode.STATE_INVALID, "Partner is inactive.");
        const balance = await partnerBalanceIn(input.partnerId, input.currency, t);
        if (input.amountMinor > balance) {
          throw new AppError(ErrorCode.VALIDATION, "Payout exceeds the partner's balance.", {
            fieldErrors: {
              amountMinor: [`amount exceeds the partner's ${input.currency} balance (${String(balance)})`],
            },
          });
        }
        const { approvalRequestId } = await deps.approvals.request(
          "payout.record",
          { type: "partner", id: input.partnerId },
          input,
          ctx.userId,
          t,
        );
        await deps.audit.log(
          ctx,
          "API-FIN-04 payout.request",
          { type: "partner", id: input.partnerId },
          { balanceMinor: balance, currency: input.currency },
          { approvalRequestId, ...input },
          t,
        );
        return { approvalRequestId };
      },
      tx,
      runner(),
    );
  }

  async function applyPayout(
    payload: PayoutRecordPayload,
    approvalRequestId: string,
    tx: TxCtx,
  ): Promise<{ payoutId: string } & PostEntriesResult> {
    const [existing] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.approvalRequestId, approvalRequestId))
      .limit(1);
    if (existing !== undefined) {
      const posted = await postPayout(existing.id, tx);
      return { payoutId: existing.id, ...posted, entryCount: 0 };
    }
    await requirePartner(payload.partnerId, tx);
    const balance = await partnerBalanceIn(payload.partnerId, payload.currency, tx);
    if (payload.amountMinor > balance) {
      throw new AppError(ErrorCode.STATE_INVALID, "Payout exceeds the partner's balance at apply time.");
    }
    const recordedBy = await finalDecider(approvalRequestId, tx);
    const [row] = await tx
      .insert(payouts)
      .values({
        partnerId: payload.partnerId,
        amountMinor: payload.amountMinor,
        currency: payload.currency,
        paidOn: payload.paidOn,
        reference: payload.reference,
        note: payload.note ?? null,
        approvalRequestId,
        recordedBy,
      })
      .returning();
    if (row === undefined) throw new Error("payout insert returned no row");
    const posted = await postPayout(row.id, tx);
    await deps.audit.log(
      SYSTEM_ACTOR(approvalRequestId),
      "API-FIN-05 payout.apply",
      { type: "payout", id: row.id },
      null,
      { ...payload, approvalRequestId, recordedBy, entryIds: posted.entryIds },
      tx,
    );
    return { payoutId: row.id, ...posted };
  }

  // -- expenses ------------------------------------------------------------------------------

  async function postExpense(expenseId: string, tx: TxCtx): Promise<PostEntriesResult> {
    const [expense] = await tx.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
    if (expense === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Expense not found.");
    const existing = await tx
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.expenseId, expenseId));
    if (existing.length > 0) return { entryIds: existing.map((e) => e.id), entryCount: 0 };
    if (expense.createdBy === null) {
      throw new AppError(ErrorCode.STATE_INVALID, "Expense has no creating admin.");
    }
    const currency = assertCurrency(expense.currency.trim());
    const incurredOn = dateColumn(expense.incurredOn);
    const at = istRange(incurredOn, incurredOn).from;
    const fxRateToInr = await deps.fx.rateToInr(currency, at, tx);
    let split: { companyCutBps: number; lines: { partnerId: string; shareBps: number }[] } | null = null;
    if (expense.sharedBySplit && expense.productId !== null) {
      const version = await deps.ownership.getActiveAt(expense.productId, at, tx);
      if (version !== null && version.lines.length > 0) {
        split = {
          companyCutBps: version.companyCutBps,
          lines: version.lines.map((l) => ({ partnerId: l.partnerId, shareBps: l.shareBps })),
        };
      }
    }
    const planned = planExpensePosting({
      expenseId,
      currency,
      fxRateToInr,
      amountMinor: expense.amountMinor,
      category: expense.category,
      split,
    });
    const entryIds = await insertEntries(planned, expense.createdBy, deps.now(), tx);
    return { entryIds, entryCount: entryIds.length };
  }

  async function recordExpense(
    ctx: RequestContext,
    input: RecordExpenseInput,
    tx?: TxCtx,
  ): Promise<RecordExpenseResult> {
    return withTx(
      async (t) => {
        let warning: string | null = null;
        if (input.productId !== undefined) {
          const [product] = await t
            .select({ id: products.id })
            .from(products)
            .where(eq(products.id, input.productId))
            .limit(1);
          if (product === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Product not found.");
          if (input.sharedBySplit) {
            const at = istRange(input.incurredOn, input.incurredOn).from;
            const version = await deps.ownership.getActiveAt(input.productId, at, t);
            if (version === null || version.lines.length === 0) {
              warning = "no ownership active on incurredOn; posted as a company-only expense";
            }
          }
        }
        const [row] = await t
          .insert(expenses)
          .values({
            productId: input.productId ?? null,
            category: input.category,
            description: input.description ?? null,
            amountMinor: input.amountMinor,
            currency: input.currency,
            incurredOn: input.incurredOn,
            sharedBySplit: input.sharedBySplit,
            receiptMediaId: input.receiptMediaId ?? null,
            createdBy: ctx.userId,
          })
          .returning();
        if (row === undefined) throw new Error("expense insert returned no row");
        const posted = await postExpense(row.id, t);
        await deps.audit.log(
          ctx,
          "API-FIN-06 expense.record",
          { type: "expense", id: row.id },
          null,
          { ...input, entryIds: posted.entryIds, warning },
          t,
        );
        return { expenseId: row.id, entryIds: posted.entryIds };
      },
      tx,
      runner(),
    );
  }

  // -- adjustments ---------------------------------------------------------------------------

  async function proposeAdjustment(
    ctx: RequestContext,
    input: ProposeAdjustmentInput,
    tx?: TxCtx,
  ): Promise<{ approvalRequestId: string }> {
    return withTx(
      async (t) => {
        for (const line of input.lines) {
          if (line.partnerId !== undefined) await requirePartner(line.partnerId, t);
        }
        const batchId = newId();
        const { approvalRequestId } = await deps.approvals.request(
          "ledger.adjustment",
          { type: "ledger", id: batchId },
          input,
          ctx.userId,
          t,
        );
        await deps.audit.log(
          ctx,
          "API-FIN-07 adjustment.propose",
          { type: "ledger", id: batchId },
          null,
          { approvalRequestId, ...input },
          t,
        );
        return { approvalRequestId };
      },
      tx,
      runner(),
    );
  }

  async function postAdjustment(approvalRequestId: string, tx: TxCtx): Promise<PostEntriesResult> {
    const [req] = await tx
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalRequestId))
      .limit(1);
    if (req === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Approval request not found.");
    if (req.type !== "ledger.adjustment") {
      throw new AppError(ErrorCode.STATE_INVALID, "Approval request is not a ledger adjustment.");
    }
    const { ledgerAdjustmentPayload } = await import("./types");
    const payload = ledgerAdjustmentPayload.parse(req.payload);
    return applyAdjustment(payload, approvalRequestId, tx);
  }

  async function applyAdjustment(
    payload: LedgerAdjustmentPayload,
    approvalRequestId: string,
    tx: TxCtx,
  ): Promise<PostEntriesResult> {
    const existing = await tx
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(
        and(eq(ledgerEntries.approvalRequestId, approvalRequestId), eq(ledgerEntries.entryType, "adjustment")),
      )
      .orderBy(asc(ledgerEntries.seq));
    if (existing.length > 0) return { entryIds: existing.map((e) => e.id), entryCount: 0 };
    const createdBy = await finalDecider(approvalRequestId, tx);
    const now = deps.now();
    const { toInrMinor } = await import("@/lib/money");
    const planned: PlannedEntry[] = [];
    for (const line of payload.lines) {
      const fxRateToInr = await deps.fx.rateToInr(line.currency, now, tx);
      planned.push({
        entryType: "adjustment",
        partyType: line.partyType,
        partnerId: line.partnerId ?? null,
        amountMinor: line.amountMinor,
        currency: line.currency,
        fxRateToInr,
        amountInrMinor: toInrMinor(line.amountMinor, fxRateToInr),
        memo: `${line.memo} — ${payload.reason}`,
        orderId: line.orderId ?? null,
        orderItemId: line.orderItemId ?? null,
        paymentId: null,
        refundId: null,
        payoutId: null,
        expenseId: null,
        approvalRequestId,
      });
    }
    const entryIds = await insertEntries(planned, createdBy, now, tx);
    await deps.audit.log(
      SYSTEM_ACTOR(approvalRequestId),
      "API-FIN-08 adjustment.apply",
      { type: "ledger", id: approvalRequestId },
      null,
      { approvalRequestId, createdBy, entryIds, lines: payload.lines.length },
      tx,
    );
    return { entryIds, entryCount: entryIds.length };
  }

  // -- queries -------------------------------------------------------------------------------

  async function listLedgerEntries(
    ctx: RequestContext,
    input: ListLedgerEntriesInput,
  ): Promise<LedgerListResult> {
    const db = deps.db;
    const scope = scopeOf(ctx);
    const f = input.filters ?? {};
    const where = [sql`true`];
    if (scope !== "all") {
      if (f.partnerId !== undefined && f.partnerId !== scope) {
        throw new AppError(ErrorCode.FORBIDDEN, "You can only read your own partner's ledger.");
      }
      const own = await ownProductIds(scope, db);
      where.push(
        own.length === 0
          ? eq(ledgerEntries.partnerId, scope)
          : (or(
              eq(ledgerEntries.partnerId, scope),
              inArray(
                ledgerEntries.orderItemId,
                db
                  .select({ id: orderItems.id })
                  .from(orderItems)
                  .where(inArray(orderItems.productId, own)),
              ),
            ) as ReturnType<typeof eq>),
      );
    }
    if (f.entryType !== undefined) where.push(inArray(ledgerEntries.entryType, f.entryType));
    if (f.partnerId !== undefined) where.push(eq(ledgerEntries.partnerId, f.partnerId));
    if (f.currency !== undefined) where.push(eq(ledgerEntries.currency, f.currency));
    if (f.approvalRequestId !== undefined) where.push(eq(ledgerEntries.approvalRequestId, f.approvalRequestId));
    if (f.productId !== undefined) {
      where.push(
        inArray(
          ledgerEntries.orderItemId,
          db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.productId, f.productId)),
        ),
      );
    }
    if (f.orderNo !== undefined) {
      where.push(
        inArray(ledgerEntries.orderId, db.select({ id: orders.id }).from(orders).where(eq(orders.orderNo, f.orderNo))),
      );
    }
    if (f.dateFrom !== undefined) where.push(gte(ledgerEntries.createdAt, istRange(f.dateFrom, f.dateFrom).from));
    if (f.dateTo !== undefined) where.push(lt(ledgerEntries.createdAt, istRange(f.dateTo, f.dateTo).to));

    const totalsRows = await db
      .select({
        entryType: ledgerEntries.entryType,
        currency: ledgerEntries.currency,
        total: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)`,
        totalInr: sql<string>`coalesce(sum(${ledgerEntries.amountInrMinor}), 0)`,
        count: sql<string>`count(*)`,
      })
      .from(ledgerEntries)
      .where(and(...where))
      .groupBy(ledgerEntries.entryType, ledgerEntries.currency);
    const currencies = new Set(totalsRows.map((r) => r.currency.trim()));
    const single = currencies.size === 1 ? assertCurrency([...currencies][0] as string) : null;
    const byType: Partial<Record<EntryType, Money>> = {};
    for (const r of totalsRows) {
      const amount = single === null ? intFromSql(r.totalInr) : intFromSql(r.total);
      const prevAmount = byType[r.entryType]?.amountMinor ?? 0;
      byType[r.entryType] = { amountMinor: prevAmount + amount, currency: single ?? "INR" };
    }
    const total = totalsRows.reduce((acc, r) => acc + intFromSql(r.count), 0);

    const { dir } = parseSort(input.sort, "seq", "asc");
    const pageWhere = [...where];
    if (input.cursor !== undefined) {
      const c = decodeCursor(input.cursor);
      const seq = intFromSql(c.sortValue);
      pageWhere.push(dir === "asc" ? gt(ledgerEntries.seq, seq) : lt(ledgerEntries.seq, seq));
    }
    const rows = await db
      .select({ entry: ledgerEntries, orderNo: orders.orderNo })
      .from(ledgerEntries)
      .leftJoin(orders, eq(orders.id, ledgerEntries.orderId))
      .where(and(...pageWhere))
      .orderBy(dir === "asc" ? asc(ledgerEntries.seq) : desc(ledgerEntries.seq))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    const last = page[page.length - 1];
    const result: LedgerListResult = {
      items: page.map((r) => toView(r.entry, r.orderNo)),
      nextCursor: rows.length > input.limit && last !== undefined ? encodeCursor(last.entry.seq, last.entry.id) : null,
      totals: { byType },
    };
    if (total < 10_000) result.total = total;
    return result;
  }

  async function getOrderAllocation(
    ctx: RequestContext,
    input: GetOrderAllocationInput,
  ): Promise<OrderAllocationView> {
    const db = deps.db;
    const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (order === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.createdAt), asc(orderItems.id));
    const allocRows = await db
      .select()
      .from(allocations)
      .where(inArray(allocations.orderItemId, items.map((i) => i.id)));
    const scope = scopeOf(ctx);
    if (scope !== "all") {
      const own = await ownProductIds(scope, db);
      const visible =
        items.some((i) => i.productId !== null && own.includes(i.productId)) ||
        allocRows.some((a) => a.lines.some((l) => l.partner_id === scope));
      if (!visible) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
    }
    if (allocRows.length === 0) {
      throw new AppError(ErrorCode.STATE_INVALID, "Order has not been posted to the ledger yet.");
    }
    const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.orderId, order.id));
    const currency = assertCurrency(order.currency);
    const m = (amountMinor: number): Money => ({ amountMinor, currency });
    const sumOf = (itemId: string, type: EntryType) =>
      entries.filter((e) => e.orderItemId === itemId && e.entryType === type).reduce((a, e) => a + e.amountMinor, 0);
    const views: ItemAllocationView[] = [];
    for (const item of items) {
      const alloc = allocRows.find((a) => a.orderItemId === item.id);
      if (alloc === undefined) continue;
      let ownershipVersion: number | null = null;
      if (alloc.ownershipId !== null) {
        const [v] = (await db.execute(
          sql`select version from product_ownerships where id = ${alloc.ownershipId}`,
        )) as unknown as { version: unknown }[];
        ownershipVersion = v === undefined ? null : intFromSql(v.version);
      }
      views.push({
        orderItemId: item.id,
        description: item.description,
        gross: m(item.unitMinor * item.quantity),
        discount: m(item.discountMinor),
        tax: m(item.taxMinor),
        gatewayFee: m(-sumOf(item.id, "gateway_fee")),
        bankCharge: m(-sumOf(item.id, "bank_charge")),
        distributable: m(alloc.distributableMinor),
        companyCut: m(alloc.companyMinor),
        companyCutBps: alloc.companyCutBps,
        lines: alloc.lines.map((l) => ({ partnerId: l.partner_id, shareBps: l.share_bps, amount: m(l.amount_minor) })),
        ownershipId: alloc.ownershipId,
        ownershipVersion,
      });
    }
    return { orderId: order.id, orderNo: order.orderNo, currency, items: views };
  }

  async function getPartnerBalances(
    ctx: RequestContext,
    input: GetPartnerBalancesInput,
  ): Promise<PartnerBalance[]> {
    const scope = scopeOf(ctx);
    if (scope !== "all" && input.partnerId !== undefined && input.partnerId !== scope) {
      throw new AppError(ErrorCode.FORBIDDEN, "You can only read your own partner's balance.");
    }
    const partnerId = scope === "all" ? input.partnerId : scope;
    const rows = await balanceRows(deps.db, partnerId === undefined ? {} : { partnerId });
    const grouped = new Map<string, PartnerBalance>();
    for (const r of rows) {
      const entry = grouped.get(r.partnerId) ?? { partnerId: r.partnerId, byCurrency: [], balanceInrMinor: 0 };
      entry.byCurrency.push({
        currency: r.currency,
        allocated: r.allocated,
        refunded: r.refunded,
        expenses: r.expenses,
        paidOut: r.paidOut,
        balance: r.balance,
      });
      entry.balanceInrMinor += r.balanceInrMinor;
      grouped.set(r.partnerId, entry);
    }
    if (partnerId !== undefined && !grouped.has(partnerId)) {
      await requirePartner(partnerId, deps.db);
      grouped.set(partnerId, { partnerId, byCurrency: [], balanceInrMinor: 0 });
    }
    return [...grouped.values()];
  }

  async function getReport(ctx: RequestContext, input: GetReportInput): Promise<ReportResult> {
    const scope = scopeOf(ctx);
    return buildReport(deps.db, input, scope === "all" ? null : scope);
  }

  async function listPayouts(ctx: RequestContext, input: ListPayoutsInput): Promise<ListResult<Payout>> {
    const db = deps.db;
    const scope = scopeOf(ctx);
    const f = input.filters ?? {};
    const where = [sql`true`];
    if (scope !== "all") {
      if (f.partnerId !== undefined && f.partnerId !== scope) throw new AppError(ErrorCode.FORBIDDEN);
      where.push(eq(payouts.partnerId, scope));
    }
    if (f.partnerId !== undefined) where.push(eq(payouts.partnerId, f.partnerId));
    if (f.dateFrom !== undefined) where.push(gte(payouts.paidOn, f.dateFrom));
    if (f.dateTo !== undefined) where.push(lte(payouts.paidOn, f.dateTo));
    const { field, dir } = parseSort(input.sort, "createdAt");
    const column = field === "paidOn" ? payouts.paidOn : field === "amount" ? payouts.amountMinor : payouts.createdAt;
    const order = dir === "asc" ? asc : desc;
    if (input.cursor !== undefined) {
      const c = decodeCursor(input.cursor);
      const v = field === "amount" ? intFromSql(c.sortValue) : field === "paidOn" ? String(c.sortValue) : new Date(String(c.sortValue));
      const cmp = dir === "asc" ? gt : lt;
      where.push(
        or(cmp(column, v as never), and(eq(column, v as never), cmp(payouts.id, c.id))) as ReturnType<typeof eq>,
      );
    }
    const rows = await db
      .select()
      .from(payouts)
      .where(and(...where))
      .orderBy(order(column), order(payouts.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit).map((r) => ({ ...r, paidOn: dateColumn(r.paidOn) }));
    const last = page[page.length - 1];
    const sortValue = (r: Payout) =>
      field === "amount" ? r.amountMinor : field === "paidOn" ? r.paidOn : timestampColumn(r.createdAt).toISOString();
    return {
      items: page,
      nextCursor: rows.length > input.limit && last !== undefined ? encodeCursor(sortValue(last), last.id) : null,
    };
  }

  async function listExpenses(ctx: RequestContext, input: ListExpensesInput): Promise<ListResult<Expense>> {
    const db = deps.db;
    const scope = scopeOf(ctx);
    const f = input.filters ?? {};
    const where = [sql`true`];
    if (scope !== "all") {
      const own = await ownProductIds(scope, db);
      where.push(
        (own.length === 0
          ? isNull(expenses.productId)
          : or(isNull(expenses.productId), inArray(expenses.productId, own))) as ReturnType<typeof eq>,
      );
    }
    if (f.productId !== undefined) where.push(eq(expenses.productId, f.productId));
    if (f.dateFrom !== undefined) where.push(gte(expenses.incurredOn, f.dateFrom));
    if (f.dateTo !== undefined) where.push(lte(expenses.incurredOn, f.dateTo));
    const { field, dir } = parseSort(input.sort, "createdAt");
    const column =
      field === "incurredOn" ? expenses.incurredOn : field === "amount" ? expenses.amountMinor : expenses.createdAt;
    const order = dir === "asc" ? asc : desc;
    if (input.cursor !== undefined) {
      const c = decodeCursor(input.cursor);
      const v =
        field === "amount" ? intFromSql(c.sortValue) : field === "incurredOn" ? String(c.sortValue) : new Date(String(c.sortValue));
      const cmp = dir === "asc" ? gt : lt;
      where.push(
        or(cmp(column, v as never), and(eq(column, v as never), cmp(expenses.id, c.id))) as ReturnType<typeof eq>,
      );
    }
    const rows = await db
      .select()
      .from(expenses)
      .where(and(...where))
      .orderBy(order(column), order(expenses.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit).map((r) => ({ ...r, incurredOn: dateColumn(r.incurredOn) }));
    const last = page[page.length - 1];
    const sortValue = (r: Expense) =>
      field === "amount" ? r.amountMinor : field === "incurredOn" ? r.incurredOn : timestampColumn(r.createdAt).toISOString();
    return {
      items: page,
      nextCursor: rows.length > input.limit && last !== undefined ? encodeCursor(sortValue(last), last.id) : null,
    };
  }

  // -- statements ----------------------------------------------------------------------------

  async function exportStatement(ctx: RequestContext, input: ExportStatementInput): Promise<StatementExport> {
    const scope = scopeOf(ctx);
    if (scope !== "all" && input.partnerId !== scope) {
      throw new AppError(ErrorCode.FORBIDDEN, "You can only export your own statement.");
    }
    return withTx(
      async (t) => {
        const partner = await requirePartner(input.partnerId, t);
        const statement = await buildStatement(t, partner, input.dateFrom, input.dateTo, deps.now());
        const stamp = deps.now().toISOString().replace(/[:.]/g, "-");
        const base = `statement-${partner.displayName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${input.dateFrom}-${input.dateTo}`;
        const filename = `${base}.${input.format}`;
        const body = input.format === "csv" ? new TextEncoder().encode(renderStatementCsv(statement)) : await renderStatementPdf(statement);
        const stored = await deps.documents.put(
          {
            objectKey: `statements/${partner.id}/${stamp}-${filename}`,
            filename,
            contentType: input.format === "csv" ? "text/csv" : "application/pdf",
            body,
            uploadedBy: ctx.userId,
          },
          t,
        );
        await deps.audit.log(
          ctx,
          "API-FIN-10 statement.export",
          { type: "partner", id: partner.id },
          null,
          { ...input, filename, mediaId: stored.mediaId },
          t,
        );
        return { url: stored.url, filename, expiresAt: stored.expiresAt };
      },
      undefined,
      runner(),
    );
  }

  return {
    postOrderPaid,
    postRefund,
    postPayout,
    postExpense,
    postAdjustment,
    computeAllocation,
    spreadDeduction,
    listLedgerEntries,
    getOrderAllocation,
    getPartnerBalances,
    getReport,
    listPayouts,
    listExpenses,
    recordPayout,
    applyPayout,
    recordExpense,
    proposeAdjustment,
    applyAdjustment,
    exportStatement,
  };
}

/** Gateway fee captured by a provider on confirm (0 for manual, docs/06 §4.2). */
function gatewayFeeOf(providerPayload: Record<string, unknown> | null): number {
  const raw = providerPayload?.["gatewayFeeMinor"];
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
}

/** The process-wide instance (ports from `configureFinanceDeps`). */
export const financeService: FinanceService = createFinanceService(lazyFinanceDeps);

/** Register the `payout.record` / `ledger.adjustment` apply + reject handlers (docs/06 §1.5). */
export function registerFinanceApprovalHandlers(
  registry: ApplyHandlerRegistry,
  service: FinanceService = financeService,
): void {
  registry.registerApplyHandler("payout.record", async (ctx, payload, tx) => {
    await service.applyPayout(payload, ctx.requestId, tx);
  });
  registry.registerApplyHandler("ledger.adjustment", async (ctx, payload, tx) => {
    await service.applyAdjustment(payload, ctx.requestId, tx);
  });
  registry.registerRejectHandler("payout.record", () => Promise.resolve());
  registry.registerRejectHandler("ledger.adjustment", () => Promise.resolve());
}
