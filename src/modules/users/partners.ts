/**
 * Partner operations (API-ADM-12, MASTER_SPEC §7, PHASE-03 P3.4).
 */
import { and, count, desc, eq } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertAnyPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { decrypt, encrypt } from "@/lib/crypto";
import type { ListResult } from "@/modules/_shared/zod";
import { users } from "../../../drizzle/schema/auth";
import { partners } from "../../../drizzle/schema/users-ext";
import { productOwnershipLines, productOwnerships } from "../../../drizzle/schema/ownership";
import type { BankDetails } from "../settings/types";
import type { PartnerView } from "./types";
import type { UpdatePartnerInput, listPartnersSchema } from "./contracts";
import type { z } from "zod";

function getOuterTx(db: DbOrTx): TxCtx | undefined {
  return "$client" in db ? undefined : (db as TxCtx);
}

function extractLast4(enc: string | null): string | null {
  if (!enc) return null;
  try {
    const raw = decrypt(enc);
    const parsed = JSON.parse(raw) as Partial<BankDetails>;
    if (parsed.accountNumber && typeof parsed.accountNumber === "string") {
      return parsed.accountNumber.slice(-4);
    }
    return null;
  } catch {
    return null;
  }
}

export async function listPartners(
  ctx: RequestContext,
  input: z.infer<typeof listPartnersSchema>,
  database: DbOrTx,
): Promise<ListResult<PartnerView>> {
  assertAnyPermission(ctx, ["finance.ledger.read_all", "users.admin.manage"]);

  const limit = input.limit ?? 25;
  const conditions = [];

  if (input.filters?.active !== undefined) {
    conditions.push(eq(partners.active, input.filters.active));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await database
    .select({
      partner: partners,
      user: users,
    })
    .from(partners)
    .innerJoin(users, eq(partners.userId, users.id))
    .where(whereClause)
    .orderBy(desc(partners.createdAt), desc(partners.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const itemsSlice = hasMore ? rows.slice(0, limit) : rows;

  const views: PartnerView[] = [];

  for (const { partner, user } of itemsSlice) {
    const [shareRow] = await database
      .select({ count: count(productOwnershipLines.ownershipId) })
      .from(productOwnershipLines)
      .innerJoin(productOwnerships, eq(productOwnershipLines.ownershipId, productOwnerships.id))
      .where(
        and(
          eq(productOwnershipLines.partnerId, partner.id),
          eq(productOwnerships.status, "active"),
        ),
      );

    const hasPayoutDetails = Boolean(partner.payoutBankDetailsEnc);
    const payoutAccountLast4 = extractLast4(partner.payoutBankDetailsEnc);

    views.push({
      id: partner.id,
      userId: partner.userId,
      displayName: partner.displayName,
      email: user.email,
      active: partner.active,
      hasPayoutDetails,
      payoutAccountLast4,
      activeShareCount: Number(shareRow?.count ?? 0),
      createdAt: partner.createdAt.toISOString(),
    });
  }

  const lastItem = itemsSlice[itemsSlice.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.partner.id : null;

  return {
    items: views,
    nextCursor,
  };
}

export async function updatePartner(
  ctx: RequestContext,
  input: UpdatePartnerInput,
  database: DbOrTx,
): Promise<{ partner: PartnerView }> {
  assertAnyPermission(ctx, ["finance.ledger.read_all", "users.admin.manage"]);

  const { withTx } = await import("@/lib/db");
  return await withTx(async (tx) => {
    const [partner] = await tx
      .select()
      .from(partners)
      .where(eq(partners.id, input.partnerId))
      .limit(1);

    if (!partner) {
      throw new AppError(ErrorCode.NOT_FOUND, "Partner not found");
    }

    const [user] = await tx.select().from(users).where(eq(users.id, partner.userId)).limit(1);

    if (!user) {
      throw new AppError(ErrorCode.NOT_FOUND, "Associated partner user not found");
    }

    const updateSet: Partial<typeof partners.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.displayName !== undefined) {
      updateSet.displayName = input.displayName;
    }
    if (input.active !== undefined) {
      updateSet.active = input.active;
    }
    if (input.payoutBankDetails !== undefined) {
      updateSet.payoutBankDetailsEnc = encrypt(JSON.stringify(input.payoutBankDetails));
    }

    const [updated] = await tx
      .update(partners)
      .set(updateSet)
      .where(eq(partners.id, input.partnerId))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to update partner");
    }

    const [shareRow] = await tx
      .select({ count: count(productOwnershipLines.ownershipId) })
      .from(productOwnershipLines)
      .innerJoin(productOwnerships, eq(productOwnershipLines.ownershipId, productOwnerships.id))
      .where(
        and(
          eq(productOwnershipLines.partnerId, updated.id),
          eq(productOwnerships.status, "active"),
        ),
      );

    await auditService.log(
      ctx,
      "API-ADM-12 partner.update",
      { type: "partner", id: input.partnerId },
      { displayName: partner.displayName, active: partner.active },
      { displayName: updated.displayName, active: updated.active },
      tx,
    );

    return {
      partner: {
        id: updated.id,
        userId: updated.userId,
        displayName: updated.displayName,
        email: user.email,
        active: updated.active,
        hasPayoutDetails: Boolean(updated.payoutBankDetailsEnc),
        payoutAccountLast4: extractLast4(updated.payoutBankDetailsEnc),
        activeShareCount: Number(shareRow?.count ?? 0),
        createdAt: updated.createdAt.toISOString(),
      },
    };
  }, getOuterTx(database));
}
