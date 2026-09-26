/**
 * Finance ledger adjustments implementation (API-FIN-07, API-FIN-08, BR-17, D-517).
 */
import { eq } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { approvalsService } from "@/modules/approvals/service";
import { fxService } from "@/modules/fx/service";
import type { ApplyContext } from "@/modules/approvals/contracts";
import type { Currency } from "@/lib/money";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { users } from "../../../drizzle/schema/auth";
import {
  ledgerAdjustmentPayload,
  proposeAdjustmentInput,
  type LedgerAdjustmentPayload,
  type PostEntriesResult,
  type ProposeAdjustmentInput,
} from "./types";

// ----------------------------------------------------------------------------------------------------
// API-FIN-07: proposeAdjustment
// ----------------------------------------------------------------------------------------------------

export async function proposeAdjustment(
  ctx: RequestContext,
  input: ProposeAdjustmentInput,
  outerTx?: TxCtx,
): Promise<{ approvalRequestId: string }> {
  assertPermission(ctx, "finance.adjustment.propose");
  const parsed = proposeAdjustmentInput.parse(input);

  const runner = async (tx: TxCtx): Promise<{ approvalRequestId: string }> => {
    const subjectId = crypto.randomUUID();
    const result = await approvalsService.request(
      "ledger.adjustment",
      { type: "ledger", id: subjectId },
      parsed,
      ctx.userId!,
      tx,
    );

    await auditService.log(
      ctx,
      "API-FIN-07 adjustment.proposed",
      { type: "approval_request", id: result.approvalRequestId },
      null,
      {
        linesCount: parsed.lines.length,
        reason: parsed.reason,
      },
      tx,
    );

    return result;
  };

  return outerTx ? runner(outerTx) : withTx(runner);
}

// ----------------------------------------------------------------------------------------------------
// postAdjustment: append ledger entries for an approved adjustment (API-FIN-08, BR-17)
// ----------------------------------------------------------------------------------------------------

export async function postAdjustment(
  approvalRequestId: string,
  tx: TxCtx,
  overridePayload?: LedgerAdjustmentPayload,
  decidedBy?: string,
): Promise<PostEntriesResult> {
  let payload = overridePayload;
  let createdBy = decidedBy;

  if (!payload) {
    const [req] = await tx
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalRequestId))
      .limit(1);

    if (!req) {
      throw new AppError(ErrorCode.NOT_FOUND, `Approval request ${approvalRequestId} not found`);
    }
    payload = ledgerAdjustmentPayload.parse(req.payload);
    createdBy = decidedBy ?? req.requestedBy;
  }

  if (!createdBy) {
    const [firstAdmin] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.status, "active"))
      .limit(1);
    createdBy = firstAdmin?.id ?? "00000000-0000-4000-8000-000000000001";
  }

  const valuesToInsert = [];

  for (const line of payload.lines) {
    const fx = await fxService.getRate(
      line.currency as Currency,
      "INR",
      new Date(),
      tx,
    );
    const fxRateToInr = fx.rate;
    const toInr = (amt: number) =>
      line.currency === "INR" ? amt : Math.round(amt * Number(fxRateToInr));

    valuesToInsert.push({
      entryType: "adjustment" as const,
      partyType: line.partyType,
      partnerId: line.partyType === "partner" ? (line.partnerId ?? null) : null,
      orderId: line.orderId ?? null,
      orderItemId: line.orderItemId ?? null,
      amountMinor: line.amountMinor,
      currency: line.currency,
      fxRateToInr,
      amountInrMinor: toInr(line.amountMinor),
      memo: line.memo,
      approvalRequestId,
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
}

// ----------------------------------------------------------------------------------------------------
// API-FIN-08: applyAdjustment (internal approval apply handler)
// ----------------------------------------------------------------------------------------------------

export async function applyAdjustment(
  payload: LedgerAdjustmentPayload,
  approvalRequestId: string,
  tx: TxCtx,
  decidedBy?: string,
): Promise<PostEntriesResult> {
  const postResult = await postAdjustment(approvalRequestId, tx, payload, decidedBy);

  await auditService.log(
    { kind: "system", name: "system" },
    "API-FIN-08 adjustment.applied",
    { type: "approval_request", id: approvalRequestId },
    null,
    {
      approvalRequestId,
      entryCount: postResult.entryCount,
    },
    tx,
  );

  return postResult;
}

// ----------------------------------------------------------------------------------------------------
// Register approval handlers for ledger.adjustment
// ----------------------------------------------------------------------------------------------------

approvalsService.registerApplyHandler(
  "ledger.adjustment",
  async (_ctx: ApplyContext, payload: LedgerAdjustmentPayload, tx: TxCtx) => {
    await applyAdjustment(payload, _ctx.requestId, tx, _ctx.decidedBy);
  },
);

approvalsService.registerRejectHandler(
  "ledger.adjustment",
  async (_ctx: ApplyContext, _payload: LedgerAdjustmentPayload, _tx: TxCtx) => {
    // onRejected: "nothing" per spec (MASTER_SPEC §7, approvals schema)
  },
);
