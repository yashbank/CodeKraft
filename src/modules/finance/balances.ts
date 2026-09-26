/**
 * Partner balances query (API-FIN-03, docs/06 §2.6, FR-FIN-06, FI-06, FI-14).
 * Reads VIEW `partner_balances`.
 */
import { eq, sql } from "drizzle-orm";
import { db, withTx, type DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission, can } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { partners } from "../../../drizzle/schema/users-ext";
import type {
  GetPartnerBalancesInput,
  PartnerBalance,
  PartnerBalanceByCurrency,
  Currency,
} from "./types";

interface PartnerBalanceViewRow {
  partner_id: string;
  currency: string;
  allocated_minor: string | number;
  refunded_minor: string | number;
  expenses_minor: string | number;
  paid_out_minor: string | number;
  adjusted_minor: string | number;
  balance_minor: string | number;
  balance_inr_minor: string | number;
  last_entry_at: Date | string | null;
}

export async function getPartnerBalances(
  ctx: RequestContext,
  input: GetPartnerBalancesInput,
  database: DbOrTx = db,
): Promise<PartnerBalance[]> {
  assertPermission(ctx, "finance.ledger.read");

  const canReadAll = can(ctx, "finance.ledger.read_all");
  let targetPartnerId = input.partnerId;

  if (!canReadAll) {
    // Non-super-admins / admin roles without read_all can only see their own partner's balance
    const [callerPartner] = await database
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.userId, ctx.userId!))
      .limit(1);

    if (!callerPartner) {
      throw new AppError(ErrorCode.FORBIDDEN, "Caller is not linked to any partner");
    }

    if (targetPartnerId && targetPartnerId !== callerPartner.id) {
      throw new AppError(ErrorCode.FORBIDDEN, "Cannot read another partner's balance (API-FIN-03)");
    }

    targetPartnerId = callerPartner.id;
  }

  // If a specific partner was targeted, verify the partner exists
  if (targetPartnerId) {
    const [partnerRow] = await database
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.id, targetPartnerId))
      .limit(1);

    if (!partnerRow) {
      throw new AppError(ErrorCode.NOT_FOUND, "Partner not found");
    }
  }

  // Query VIEW partner_balances
  const query = targetPartnerId
    ? sql<PartnerBalanceViewRow>`SELECT * FROM partner_balances WHERE partner_id = ${targetPartnerId} ORDER BY currency`
    : sql<PartnerBalanceViewRow>`SELECT * FROM partner_balances ORDER BY partner_id, currency`;

  const rows = await database.execute<PartnerBalanceViewRow>(query);

  // Group by partner_id
  const partnerMap = new Map<string, PartnerBalance>();

  for (const row of rows) {
    const pId = row.partner_id;
    if (!partnerMap.has(pId)) {
      partnerMap.set(pId, {
        partnerId: pId,
        byCurrency: [],
        balanceInrMinor: 0,
      });
    }

    const current = partnerMap.get(pId)!;
    const byCurr: PartnerBalanceByCurrency = {
      currency: row.currency as Currency,
      allocated: Number(row.allocated_minor),
      refunded: Number(row.refunded_minor),
      expenses: Number(row.expenses_minor),
      paidOut: Number(row.paid_out_minor),
      balance: Number(row.balance_minor),
    };

    current.byCurrency.push(byCurr);
    current.balanceInrMinor += Number(row.balance_inr_minor);
  }

  // If specific partner was requested but has no ledger entries yet
  if (targetPartnerId && !partnerMap.has(targetPartnerId)) {
    return [
      {
        partnerId: targetPartnerId,
        byCurrency: [],
        balanceInrMinor: 0,
      },
    ];
  }

  return Array.from(partnerMap.values());
}
