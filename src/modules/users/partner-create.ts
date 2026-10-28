/**
 * Partner creation (API-ADM-12): link an admin user as a partner, and the idempotent
 * "make every super admin a partner" backfill. `partners.user_id` is NOT NULL + UNIQUE, so a
 * partner is always an existing admin-class user; shares are then set in the ownership editor.
 */
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertAnyPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { userRoles, users } from "../../../drizzle/schema/auth";
import { partners } from "../../../drizzle/schema/users-ext";
import type { PartnerView } from "./types";
import type { CreatePartnerInput } from "./contracts";

const ADMIN_CLASS = ["super_admin", "admin"] as const;

function getOuterTx(db: DbOrTx): TxCtx | undefined {
  return "$client" in db ? undefined : (db as TxCtx);
}

function toView(partner: typeof partners.$inferSelect, email: string): PartnerView {
  return {
    id: partner.id,
    userId: partner.userId,
    displayName: partner.displayName,
    email,
    active: partner.active,
    hasPayoutDetails: Boolean(partner.payoutBankDetailsEnc),
    payoutAccountLast4: null,
    activeShareCount: 0,
    createdAt: partner.createdAt.toISOString(),
  };
}

/** Admin-class users (not deleted/anonymised) that have no partner row yet. */
export async function listPartnerCandidates(
  ctx: RequestContext,
  database: DbOrTx,
): Promise<{ items: { userId: string; name: string; email: string }[] }> {
  assertAnyPermission(ctx, ["users.admin.manage"]);
  const rows = await database
    .selectDistinct({ userId: users.id, name: users.name, email: users.email })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(partners, eq(partners.userId, users.id))
    .where(
      and(
        inArray(userRoles.roleKey, [...ADMIN_CLASS]),
        isNull(users.deletedAt),
        isNull(users.anonymizedAt),
        isNull(partners.id),
      ),
    )
    .orderBy(asc(users.email));
  return { items: rows.map((r) => ({ ...r, email: String(r.email) })) };
}

/** Link an existing admin-class user (by id or email) as a partner. One partner row per user. */
export async function createPartner(
  ctx: RequestContext,
  input: CreatePartnerInput,
  database: DbOrTx,
): Promise<{ partner: PartnerView }> {
  assertAnyPermission(ctx, ["users.admin.manage"]);
  const { withTx } = await import("@/lib/db");
  return await withTx(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(
        input.userId !== undefined
          ? eq(users.id, input.userId)
          : eq(users.email, input.email ?? ""),
      )
      .limit(1);
    if (!user || user.deletedAt || user.anonymizedAt) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "No active user with that email. Invite them as an admin first, then add them as a partner.",
      );
    }
    const roleRows = await tx
      .select({ roleKey: userRoles.roleKey })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));
    if (!roleRows.some((r) => (ADMIN_CLASS as readonly string[]).includes(r.roleKey))) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Only admin users can be partners. Invite them as an admin first.",
      );
    }
    const [existing] = await tx
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.userId, user.id))
      .limit(1);
    if (existing) {
      throw new AppError(ErrorCode.CONFLICT, "That user is already a partner.");
    }
    const [created] = await tx
      .insert(partners)
      .values({
        userId: user.id,
        displayName: input.displayName ?? (user.name || String(user.email)),
      })
      .returning();
    if (!created) throw new AppError(ErrorCode.INTERNAL, "Failed to create partner");
    await auditService.log(
      ctx,
      "API-ADM-12 partner.create",
      { type: "partner", id: created.id },
      null,
      { userId: user.id, displayName: created.displayName },
      tx,
    );
    return { partner: toView(created, String(user.email)) };
  }, getOuterTx(database));
}

/**
 * Super admin only, idempotent: creates a partner row for each super admin lacking one. A second
 * run creates nothing and writes no audit rows.
 */
export async function ensureSuperAdminPartners(
  ctx: RequestContext,
  database: DbOrTx,
): Promise<{ created: PartnerView[]; existing: number }> {
  assertAnyPermission(ctx, ["users.admin.manage"]);
  if (!ctx.roles.includes("super_admin")) {
    throw new AppError(ErrorCode.FORBIDDEN, "Only a super admin can do this.");
  }
  const { withTx } = await import("@/lib/db");
  return await withTx(async (tx) => {
    const admins = await tx
      .selectDistinct({ user: users })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleKey, "super_admin"),
          isNull(users.deletedAt),
          isNull(users.anonymizedAt),
        ),
      );
    const created: PartnerView[] = [];
    let existing = 0;
    for (const { user } of admins) {
      const [row] = await tx
        .insert(partners)
        .values({ userId: user.id, displayName: user.name || String(user.email) })
        .onConflictDoNothing({ target: partners.userId })
        .returning();
      if (!row) {
        existing += 1;
        continue;
      }
      await auditService.log(
        ctx,
        "API-ADM-12 partner.create",
        { type: "partner", id: row.id },
        null,
        { userId: user.id, displayName: row.displayName, source: "ensure_super_admins" },
        tx,
      );
      created.push(toView(row, String(user.email)));
    }
    return { created, existing };
  }, getOuterTx(database));
}
