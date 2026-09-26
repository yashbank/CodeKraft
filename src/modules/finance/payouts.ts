/**
 * Finance payouts implementation (API-FIN-04, API-FIN-05, API-FIN-11, master plan §5, FR-FIN-06, FR-FIN-07, FI-06, FI-14).
 */
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { TxCtx, DbOrTx } from "@/lib/db";
import { db, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission, can } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { approvalsService } from "@/modules/approvals/service";
import { fxService } from "@/modules/fx/service";
import type { ApplyContext } from "@/modules/approvals/contracts";
import { ledgerEntries, payouts } from "../../../drizzle/schema/finance";
import { partners } from "../../../drizzle/schema/users-ext";
import { users } from "../../../drizzle/schema/auth";
import { notifications } from "../../../drizzle/schema/notifications";
import type {
  Currency,
  ListPayoutsInput,
  Payout,
  PayoutRecordPayload,
  PostEntriesResult,
  RecordPayoutInput,
} from "./types";
import type { ListResult } from "@/modules/_shared/zod";

// ----------------------------------------------------------------------------------------------------
// Helper: get current balance in currency
// ----------------------------------------------------------------------------------------------------

async function getPartnerCurrencyBalance(
  partnerId: string,
  currency: string,
  tx: DbOrTx,
): Promise<number> {
  const result = await tx.execute<{ balance_minor: string | number }>(
    sql`SELECT balance_minor FROM partner_balances WHERE partner_id = ${partnerId} AND currency = ${currency} LIMIT 1`,
  );
  if (!result || result.length === 0) return 0;
  return Number(result[0]?.balance_minor ?? 0);
}

// ----------------------------------------------------------------------------------------------------
// API-FIN-04: recordPayout
// ----------------------------------------------------------------------------------------------------

export async function recordPayout(
  ctx: RequestContext,
  input: RecordPayoutInput,
  outerTx?: TxCtx,
): Promise<{ approvalRequestId: string }> {
  assertPermission(ctx, "finance.payout.record");

  const runner = async (tx: TxCtx): Promise<{ approvalRequestId: string }> => {
    // 1. Verify partner exists
    const [partner] = await tx
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.id, input.partnerId))
      .limit(1);

    if (!partner) {
      throw new AppError(ErrorCode.NOT_FOUND, "Partner not found");
    }

    // 2. Balance check (FI-14): Payout amount cannot exceed available balance in that currency
    const currentBalance = await getPartnerCurrencyBalance(input.partnerId, input.currency, tx);
    if (input.amountMinor > currentBalance) {
      throw new AppError(
        ErrorCode.VALIDATION,
        `Payout amount (${input.amountMinor}) exceeds partner balance (${currentBalance}) in ${input.currency} (FI-14)`,
      );
    }

    // 3. Create payout.record approval request (BR-13)
    const { approvalRequestId } = await approvalsService.request(
      "payout.record",
      { type: "partner", id: input.partnerId },
      input,
      ctx.userId!,
      tx,
    );

    // 4. Audit log
    await auditService.log(
      ctx,
      "API-FIN-04 payout.requested",
      { type: "payout_request", id: approvalRequestId },
      null,
      { ...input, approvalRequestId },
      tx,
    );

    return { approvalRequestId };
  };

  if (outerTx) return await runner(outerTx);
  return await withTx(runner);
}

// ----------------------------------------------------------------------------------------------------
// Master Plan §5: postPayout
// ----------------------------------------------------------------------------------------------------

export async function postPayout(payoutId: string, tx: TxCtx): Promise<PostEntriesResult> {
  const [payout] = await tx
    .select()
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1);

  if (!payout) {
    throw new AppError(ErrorCode.NOT_FOUND, "Payout not found");
  }

  const paidOnDate = new Date(payout.paidOn);
  const fxRateToInr =
    payout.currency === "INR"
      ? "1.00000000"
      : await fxService.rateToInrOn(payout.currency as Currency, paidOnDate, tx);

  const fxNum = parseFloat(fxRateToInr);
  const amountInrMinor = Math.round(payout.amountMinor * fxNum);

  // Fallback user if recordedBy is null
  let createdBy = payout.recordedBy;
  if (!createdBy) {
    const [firstAdmin] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.status, "active"))
      .limit(1);
    createdBy = firstAdmin?.id ?? "00000000-0000-4000-8000-000000000001";
  }

  // Payout is a negative entry against the partner
  const [entry] = await tx
    .insert(ledgerEntries)
    .values({
      entryType: "payout",
      partyType: "partner",
      partnerId: payout.partnerId,
      payoutId: payout.id,
      amountMinor: -payout.amountMinor,
      currency: payout.currency,
      fxRateToInr,
      amountInrMinor: -amountInrMinor,
      memo: payout.reference,
      approvalRequestId: payout.approvalRequestId,
      createdBy,
      createdAt: new Date(),
    })
    .returning({ id: ledgerEntries.id });

  return {
    entryIds: [entry!.id],
    entryCount: 1,
  };
}

// ----------------------------------------------------------------------------------------------------
// API-FIN-05: applyPayout (approval apply handler)
// ----------------------------------------------------------------------------------------------------

export async function applyPayout(
  payload: PayoutRecordPayload,
  approvalRequestId: string,
  tx: TxCtx,
  decidedBy?: string,
): Promise<{ payoutId: string } & PostEntriesResult> {
  // Re-check partner balance at execution time
  const currentBalance = await getPartnerCurrencyBalance(payload.partnerId, payload.currency, tx);
  if (payload.amountMinor > currentBalance) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `Payout amount (${payload.amountMinor}) exceeds partner balance (${currentBalance}) in ${payload.currency} at apply time`,
    );
  }

  // 1. Insert immutable payouts row
  const [payout] = await tx
    .insert(payouts)
    .values({
      partnerId: payload.partnerId,
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      paidOn: payload.paidOn,
      reference: payload.reference,
      note: payload.note ?? null,
      approvalRequestId,
      recordedBy: decidedBy ?? null,
    })
    .returning();

  // 2. Post ledger entry
  const postResult = await postPayout(payout!.id, tx);

  // 3. Notify the partner
  const [partner] = await tx
    .select({ userId: partners.userId })
    .from(partners)
    .where(eq(partners.id, payload.partnerId))
    .limit(1);

  if (partner?.userId) {
    await tx.insert(notifications).values({
      userId: partner.userId,
      type: "payout.recorded",
      title: "Payout recorded",
      body: `A payout of ${payload.amountMinor} ${payload.currency} has been recorded (Ref: ${payload.reference}).`,
    });
  }

  // 4. Audit
  await auditService.log(
    { kind: "system", name: "system" },
    "API-FIN-05 payout.applied",
    { type: "payout", id: payout!.id },
    null,
    {
      payoutId: payout!.id,
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      approvalRequestId,
    },
    tx,
  );

  return {
    payoutId: payout!.id,
    ...postResult,
  };
}

// ----------------------------------------------------------------------------------------------------
// API-FIN-11: listPayouts
// ----------------------------------------------------------------------------------------------------

export async function listPayouts(
  ctx: RequestContext,
  input: ListPayoutsInput,
  database: DbOrTx = db,
): Promise<ListResult<Payout>> {
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
      throw new AppError(ErrorCode.FORBIDDEN, "Cannot read another partner's payouts");
    }

    partnerFilter = callerPartner.id;
  }

  const conditions = [];
  if (partnerFilter) {
    conditions.push(eq(payouts.partnerId, partnerFilter));
  }
  if (input.dateFrom) {
    conditions.push(gte(payouts.paidOn, input.dateFrom));
  }
  if (input.dateTo) {
    conditions.push(lte(payouts.paidOn, input.dateTo));
  }

  const limit = Math.min(input.limit ?? 50, 100);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRes] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(payouts)
    .where(whereClause);

  const total = countRes?.count ?? 0;

  const rows = await database
    .select()
    .from(payouts)
    .where(whereClause)
    .orderBy(desc(payouts.paidOn), desc(payouts.createdAt))
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
// Register approval handlers for payout.record
// ----------------------------------------------------------------------------------------------------

approvalsService.registerApplyHandler(
  "payout.record",
  async (_ctx: ApplyContext, payload: PayoutRecordPayload, tx: TxCtx) => {
    await applyPayout(payload, _ctx.requestId, tx, _ctx.decidedBy);
  },
);

approvalsService.registerRejectHandler(
  "payout.record",
  async (_ctx: ApplyContext, _payload: PayoutRecordPayload, _tx: TxCtx) => {
    // onRejected: "nothing" per spec (MASTER_SPEC §7, approvals schema)
  },
);
