/**
 * Finance expenses implementation (API-FIN-06, API-FIN-11, FR-FIN-08, FR-FIN-09, FR-FIN-14, D-514, FI-13).
 */
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { TxCtx, DbOrTx } from "@/lib/db";
import { db, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission, can } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { fxService } from "@/modules/fx/service";
import { ownershipService } from "@/modules/ownership/service";
import { allocateLargestRemainder, mulBps, type Currency } from "@/lib/money";
import { expenses, ledgerEntries, type Expense } from "../../../drizzle/schema/finance";
import { partners } from "../../../drizzle/schema/users-ext";
import { users } from "../../../drizzle/schema/auth";
import type {
  ListExpensesInput,
  PostEntriesResult,
  RecordExpenseInput,
  RecordExpenseResult,
} from "./types";
import type { ListResult } from "@/modules/_shared/zod";

// ----------------------------------------------------------------------------------------------------
// API-FIN-06: recordExpense
// ----------------------------------------------------------------------------------------------------

export async function recordExpense(
  ctx: RequestContext,
  input: RecordExpenseInput,
  outerTx?: TxCtx,
): Promise<RecordExpenseResult> {
  assertPermission(ctx, "finance.expense.write");

  const runner = async (tx: TxCtx): Promise<RecordExpenseResult> => {
    // If sharedBySplit is true, verify active ownership exists at incurredOn (API-FIN-06, docs/06 §2.6)
    if (input.sharedBySplit && input.productId) {
      const activeOwnership = await ownershipService.getActiveAt(
        input.productId,
        new Date(input.incurredOn),
        tx,
      );
      if (!activeOwnership) {
        throw new AppError(
          ErrorCode.VALIDATION,
          `Product ${input.productId} has no active ownership on ${input.incurredOn} for shared expense`,
        );
      }
    }

    // 1. Insert expenses row
    const [exp] = await tx
      .insert(expenses)
      .values({
        productId: input.productId ?? null,
        category: input.category,
        description: input.description ?? null,
        amountMinor: input.amountMinor,
        currency: input.currency,
        incurredOn: input.incurredOn,
        sharedBySplit: input.sharedBySplit ?? true,
        receiptMediaId: input.receiptMediaId ?? null,
        createdBy: ctx.userId ?? null,
        createdAt: new Date(),
      })
      .returning();

    if (!exp) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to insert expense record");
    }

    // 2. Post ledger entries
    const postResult = await postExpense(exp.id, tx, ctx.userId);

    // 3. Audit log
    await auditService.log(
      ctx,
      "API-FIN-06 expense.recorded",
      { type: "expense", id: exp.id },
      null,
      {
        expenseId: exp.id,
        amountMinor: input.amountMinor,
        currency: input.currency,
        sharedBySplit: input.sharedBySplit ?? true,
        productId: input.productId ?? null,
      },
      tx,
    );

    return {
      expenseId: exp.id,
      entryIds: postResult.entryIds,
    };
  };

  return outerTx ? runner(outerTx) : withTx(runner);
}

// ----------------------------------------------------------------------------------------------------
// postExpense: internal ledger posting for an expense (API-FIN-06, D-514, FI-13)
// ----------------------------------------------------------------------------------------------------

export async function postExpense(
  expenseId: string,
  tx: TxCtx,
  actorUserId?: string,
): Promise<PostEntriesResult> {
  // Fetch expense
  const [expense] = await tx
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);

  if (!expense) {
    throw new AppError(ErrorCode.NOT_FOUND, `Expense ${expenseId} not found`);
  }

  // Determine user to attribute ledger entries to
  let createdBy = expense.createdBy ?? actorUserId;
  if (!createdBy) {
    const [firstAdmin] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.status, "active"))
      .limit(1);
    createdBy = firstAdmin?.id ?? "00000000-0000-4000-8000-000000000001";
  }

  // FX rate to INR as of incurredOn
  const fxResult = await fxService.getRate(
    expense.currency as Currency,
    "INR",
    new Date(expense.incurredOn),
    tx,
  );
  const fxRateToInr = fxResult.rate;
  const toInr = (amtMinor: number) =>
    expense.currency === "INR" ? amtMinor : Math.round(amtMinor * Number(fxRateToInr));

  const memo = expense.description ?? expense.category;

  if (expense.sharedBySplit && expense.productId) {
    // Shared expense: lookup active ownership on incurredOn
    const ownership = await ownershipService.getActiveAt(
      expense.productId,
      new Date(expense.incurredOn),
      tx,
    );
    if (!ownership) {
      throw new AppError(
        ErrorCode.VALIDATION,
        `Product ${expense.productId} has no active ownership on ${expense.incurredOn} for shared expense`,
      );
    }

    // Company cut
    const companyCutMinor = mulBps(
      { amountMinor: expense.amountMinor, currency: expense.currency as Currency },
      ownership.companyCutBps,
    ).amountMinor;

    const partnerPoolMinor = expense.amountMinor - companyCutMinor;
    const partnerAmounts = allocateLargestRemainder(
      partnerPoolMinor,
      ownership.lines.map((l) => l.shareBps),
    );

    const valuesToInsert = [];

    // Partner negative entries
    for (let i = 0; i < ownership.lines.length; i++) {
      const line = ownership.lines[i]!;
      const partMinor = partnerAmounts[i]!;
      if (partMinor > 0) {
        valuesToInsert.push({
          entryType: "expense" as const,
          partyType: "partner" as const,
          partnerId: line.partnerId,
          expenseId: expense.id,
          amountMinor: -partMinor,
          currency: expense.currency,
          fxRateToInr,
          amountInrMinor: -toInr(partMinor),
          memo,
          createdBy,
          createdAt: new Date(),
        });
      }
    }

    // Company negative entry if company cut > 0
    if (companyCutMinor > 0) {
      valuesToInsert.push({
        entryType: "expense" as const,
        partyType: "company" as const,
        partnerId: null,
        expenseId: expense.id,
        amountMinor: -companyCutMinor,
        currency: expense.currency,
        fxRateToInr,
        amountInrMinor: -toInr(companyCutMinor),
        memo,
        createdBy,
        createdAt: new Date(),
      });
    }

    const inserted = await tx
      .insert(ledgerEntries)
      .values(valuesToInsert)
      .returning({ id: ledgerEntries.id });

    return {
      entryIds: inserted.map((e) => e.id),
      entryCount: inserted.length,
    };
  } else {
    // Company-only expense: single negative company entry
    const [inserted] = await tx
      .insert(ledgerEntries)
      .values({
        entryType: "expense" as const,
        partyType: "company" as const,
        partnerId: null,
        expenseId: expense.id,
        amountMinor: -expense.amountMinor,
        currency: expense.currency,
        fxRateToInr,
        amountInrMinor: -toInr(expense.amountMinor),
        memo,
        createdBy,
        createdAt: new Date(),
      })
      .returning({ id: ledgerEntries.id });

    return {
      entryIds: [inserted!.id],
      entryCount: 1,
    };
  }
}

// ----------------------------------------------------------------------------------------------------
// API-FIN-11: listExpenses
// ----------------------------------------------------------------------------------------------------

export async function listExpenses(
  ctx: RequestContext,
  input: ListExpensesInput,
  database: DbOrTx = db,
): Promise<ListResult<Expense>> {
  assertPermission(ctx, "finance.ledger.read");

  const canReadAll = can(ctx, "finance.ledger.read_all");
  let partnerFilter = input.partnerId;

  if (!canReadAll) {
    const [callerPartner] = await database
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.userId, ctx.userId!))
      .limit(1);

    if (!callerPartner) {
      return { items: [], total: 0, nextCursor: null, hasMore: false };
    }

    if (partnerFilter && partnerFilter !== callerPartner.id) {
      throw new AppError(ErrorCode.FORBIDDEN, "Cannot read another partner's expenses");
    }

    partnerFilter = callerPartner.id;
  }

  const conditions = [];

  if (input.productId) {
    conditions.push(eq(expenses.productId, input.productId));
  }
  if (input.dateFrom) {
    conditions.push(gte(expenses.incurredOn, input.dateFrom));
  }
  if (input.dateTo) {
    conditions.push(lte(expenses.incurredOn, input.dateTo));
  }

  if (partnerFilter) {
    // Only return expenses that have ledger entries affecting this partner
    const subquery = database
      .selectDistinct({ expenseId: ledgerEntries.expenseId })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.entryType, "expense"),
          eq(ledgerEntries.partnerId, partnerFilter),
          sql`${ledgerEntries.expenseId} IS NOT NULL`,
        ),
      );

    conditions.push(inArray(expenses.id, subquery));
  }

  const limit = Math.min(input.limit ?? 50, 100);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRes] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(expenses)
    .where(whereClause);

  const total = countRes?.count ?? 0;

  const rows = await database
    .select()
    .from(expenses)
    .where(whereClause)
    .orderBy(desc(expenses.incurredOn), desc(expenses.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    total,
    nextCursor,
    hasMore,
  };
}

// ----------------------------------------------------------------------------------------------------
// Product profit helper (FR-FIN-14: Σ sale − discount − refunds − Σ expenses linked to product)
// ----------------------------------------------------------------------------------------------------

export async function computeProductProfit(
  productId: string,
  tx: DbOrTx = db,
  dateFrom?: string,
  dateTo?: string,
): Promise<{
  saleMinor: number;
  discountMinor: number;
  refundMinor: number;
  expenseMinor: number;
  profitMinor: number;
  profitInrMinor: number;
}> {
  // Query product ledger entries through orderItems join or expense productId
  const conditions = [
    sql`(${ledgerEntries.orderItemId} IN (SELECT id FROM order_items WHERE product_id = ${productId}) OR ${ledgerEntries.expenseId} IN (SELECT id FROM expenses WHERE product_id = ${productId}))`,
  ];

  if (dateFrom) {
    conditions.push(gte(ledgerEntries.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(ledgerEntries.createdAt, new Date(dateTo)));
  }

  const entries = await tx
    .select({
      entryType: ledgerEntries.entryType,
      amountMinor: ledgerEntries.amountMinor,
      amountInrMinor: ledgerEntries.amountInrMinor,
    })
    .from(ledgerEntries)
    .where(and(...conditions));

  let saleMinor = 0;
  let discountMinor = 0;
  let refundMinor = 0;
  let expenseMinor = 0;
  let profitInrMinor = 0;

  for (const entry of entries) {
    profitInrMinor += entry.amountInrMinor;
    if (entry.entryType === "sale") {
      saleMinor += Math.abs(entry.amountMinor);
    } else if (entry.entryType === "discount") {
      discountMinor += Math.abs(entry.amountMinor);
    } else if (entry.entryType.startsWith("refund_")) {
      refundMinor += Math.abs(entry.amountMinor);
    } else if (entry.entryType === "expense") {
      expenseMinor += Math.abs(entry.amountMinor);
    }
  }

  const profitMinor = saleMinor - discountMinor - refundMinor - expenseMinor;

  return {
    saleMinor,
    discountMinor,
    refundMinor,
    expenseMinor,
    profitMinor,
    profitInrMinor,
  };
}
