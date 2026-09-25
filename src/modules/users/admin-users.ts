/**
 * Admin user operations with dual-admin approval workflows (API-ADM-11, MASTER_SPEC §7, PHASE-03 P3.4).
 */
import { and, count, eq, inArray } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { countActiveAdmins } from "@/modules/approvals/approver-set";
import type { ApprovalPayloadMap } from "@/modules/approvals/types";
import { sessions, userRoles, users } from "../../../drizzle/schema/auth";
import { partners } from "../../../drizzle/schema/users-ext";
import { productOwnershipLines, productOwnerships } from "../../../drizzle/schema/ownership";
import { leads } from "../../../drizzle/schema/leads";
import type { AdminUserChangePayload } from "./types";
import type {
  AdminUserChangeResult,
  changeAdminRoleSchema,
  inviteAdminSchema,
  removeAdminSchema,
} from "./contracts";
import type { z } from "zod";

function getOuterTx(db: DbOrTx): TxCtx | undefined {
  return "$client" in db ? undefined : (db as TxCtx);
}

export async function countActiveSuperAdmins(database: DbOrTx): Promise<number> {
  const rows = await database
    .select({ userId: users.id })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .where(and(eq(users.status, "active"), eq(userRoles.roleKey, "super_admin")));

  return new Set(rows.map((r) => r.userId)).size;
}

export async function hasActiveProductOwnershipShare(
  userId: string,
  database: DbOrTx,
): Promise<boolean> {
  const [partner] = await database
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.userId, userId))
    .limit(1);

  if (!partner) return false;

  const [activeShare] = await database
    .select({ count: count(productOwnershipLines.ownershipId) })
    .from(productOwnershipLines)
    .innerJoin(productOwnerships, eq(productOwnershipLines.ownershipId, productOwnerships.id))
    .where(
      and(eq(productOwnershipLines.partnerId, partner.id), eq(productOwnerships.status, "active")),
    );

  return Number(activeShare?.count ?? 0) > 0;
}

export async function inviteAdmin(
  ctx: RequestContext,
  input: z.infer<typeof inviteAdminSchema>,
  database: DbOrTx,
): Promise<AdminUserChangeResult> {
  assertPermission(ctx, "users.admin.manage");

  const currentAdmins = await countActiveAdmins(database);
  const warning = currentAdmins < 2 ? ("fewer_than_two_admins" as const) : undefined;

  const payload: ApprovalPayloadMap["admin.user_change"] = {
    kind: "invite",
    email: input.email,
    role: input.role,
    ...(input.partner ? { partner: input.partner } : {}),
  };

  const { withTx } = await import("@/lib/db");
  return await withTx(async (tx) => {
    const { approvalRequestId } = await approvalsService.request(
      "admin.user_change",
      { type: "user", id: crypto.randomUUID() },
      payload,
      ctx.userId,
      tx,
    );

    return {
      approvalRequestId,
      ...(warning ? { warning } : {}),
    };
  }, getOuterTx(database));
}

export async function changeAdminRole(
  ctx: RequestContext,
  input: z.infer<typeof changeAdminRoleSchema>,
  database: DbOrTx,
): Promise<AdminUserChangeResult> {
  assertPermission(ctx, "users.admin.manage");

  const [targetUser] = await database
    .select()
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!targetUser) {
    throw new AppError(ErrorCode.NOT_FOUND, "Target admin user not found");
  }

  // Refusal: demoting last super_admin
  const roles = await database
    .select({ roleKey: userRoles.roleKey })
    .from(userRoles)
    .where(eq(userRoles.userId, input.userId));

  const hasSuperAdmin = roles.some((r) => r.roleKey === "super_admin");
  if (hasSuperAdmin && input.role !== "super_admin") {
    const superCount = await countActiveSuperAdmins(database);
    if (superCount <= 1) {
      throw new AppError(ErrorCode.STATE_INVALID, "Cannot demote the last super_admin");
    }
  }

  const currentAdmins = await countActiveAdmins(database);
  const isCurrentlyAdminClass = roles.some(
    (r) => r.roleKey === "admin" || r.roleKey === "super_admin",
  );
  const willBeAdminClass = input.role === "admin" || input.role === "super_admin";

  let warning: "fewer_than_two_admins" | undefined;
  if (isCurrentlyAdminClass && !willBeAdminClass) {
    if (currentAdmins - 1 < 2) {
      warning = "fewer_than_two_admins";
    }
  } else if (currentAdmins < 2) {
    warning = "fewer_than_two_admins";
  }

  const payload: ApprovalPayloadMap["admin.user_change"] = {
    kind: "change_role",
    userId: input.userId,
    role: input.role,
  };

  const { withTx } = await import("@/lib/db");
  return await withTx(async (tx) => {
    const { approvalRequestId } = await approvalsService.request(
      "admin.user_change",
      { type: "user", id: input.userId },
      payload,
      ctx.userId,
      tx,
    );

    return {
      approvalRequestId,
      ...(warning ? { warning } : {}),
    };
  }, getOuterTx(database));
}

export async function removeAdmin(
  ctx: RequestContext,
  input: z.infer<typeof removeAdminSchema>,
  database: DbOrTx,
): Promise<AdminUserChangeResult> {
  assertPermission(ctx, "users.admin.manage");

  const [targetUser] = await database
    .select()
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!targetUser) {
    throw new AppError(ErrorCode.NOT_FOUND, "Target admin user not found");
  }

  const roles = await database
    .select({ roleKey: userRoles.roleKey })
    .from(userRoles)
    .where(eq(userRoles.userId, input.userId));

  // Refusal 1: removing the last super_admin
  const hasSuperAdmin = roles.some((r) => r.roleKey === "super_admin");
  if (hasSuperAdmin) {
    const superCount = await countActiveSuperAdmins(database);
    if (superCount <= 1) {
      throw new AppError(ErrorCode.STATE_INVALID, "Cannot remove the last super_admin");
    }
  }

  // Refusal 2: removing partner holding an active share
  const hasActiveShare = await hasActiveProductOwnershipShare(input.userId, database);
  if (hasActiveShare) {
    throw new AppError(
      ErrorCode.STATE_INVALID,
      "Cannot remove a partner holding an active product ownership share",
    );
  }

  // Warning check: leaves fewer than two active admins
  const currentAdmins = await countActiveAdmins(database);
  const isCurrentlyAdminClass = roles.some(
    (r) => r.roleKey === "admin" || r.roleKey === "super_admin",
  );
  const remainingAdmins = isCurrentlyAdminClass ? currentAdmins - 1 : currentAdmins;
  const warning = remainingAdmins < 2 ? ("fewer_than_two_admins" as const) : undefined;

  const payload: ApprovalPayloadMap["admin.user_change"] = {
    kind: "remove",
    userId: input.userId,
  };

  const { withTx } = await import("@/lib/db");
  return await withTx(async (tx) => {
    const { approvalRequestId } = await approvalsService.request(
      "admin.user_change",
      { type: "user", id: input.userId },
      payload,
      ctx.userId,
      tx,
    );

    return {
      approvalRequestId,
      ...(warning ? { warning } : {}),
    };
  }, getOuterTx(database));
}

export async function applyAdminUserChange(
  payload: AdminUserChangePayload,
  tx: TxCtx,
): Promise<void> {
  const isInvite =
    ("kind" in payload && payload.kind === "invite") ||
    ("op" in payload && payload.op === "invite");
  const isChangeRole =
    ("kind" in payload && payload.kind === "change_role") ||
    ("op" in payload && payload.op === "change_role");
  const isRemove =
    ("kind" in payload && payload.kind === "remove") ||
    ("op" in payload && payload.op === "remove");

  if (isInvite) {
    const p = payload as {
      email: string;
      role: (typeof userRoles.$inferInsert)["roleKey"];
      partner?: { displayName: string };
    };
    const [existing] = await tx.select().from(users).where(eq(users.email, p.email)).limit(1);

    let userId: string;
    if (!existing) {
      const [created] = await tx
        .insert(users)
        .values({
          email: p.email,
          name: p.partner?.displayName ?? p.email.split("@")[0] ?? "Admin",
          status: "active",
          emailVerified: true,
        })
        .returning();
      if (!created) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to create user");
      }
      userId = created.id;
    } else {
      userId = existing.id;
    }

    await tx
      .insert(userRoles)
      .values({
        userId,
        roleKey: p.role,
      })
      .onConflictDoNothing();

    if (p.partner) {
      await tx
        .insert(partners)
        .values({
          userId,
          displayName: p.partner.displayName,
          active: true,
        })
        .onConflictDoNothing();
    }
  } else if (isChangeRole) {
    const p = payload as {
      userId: string;
      role: (typeof userRoles.$inferInsert)["roleKey"];
    };
    await tx
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, p.userId),
          inArray(userRoles.roleKey, ["super_admin", "admin", "staff"]),
        ),
      );

    await tx
      .insert(userRoles)
      .values({
        userId: p.userId,
        roleKey: p.role,
      })
      .onConflictDoNothing();
  } else if (isRemove) {
    const p = payload as { userId: string };
    await tx.delete(userRoles).where(eq(userRoles.userId, p.userId));

    await tx
      .update(partners)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(partners.userId, p.userId));

    await tx.delete(sessions).where(eq(sessions.userId, p.userId));

    await tx.update(leads).set({ assignedTo: null }).where(eq(leads.assignedTo, p.userId));
  }
}
