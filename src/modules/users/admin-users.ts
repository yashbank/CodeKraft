/**
 * Admin user operations with dual-admin approval workflows (API-ADM-11, MASTER_SPEC §7, PHASE-03 P3.4).
 */
import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { countActiveAdmins } from "@/modules/approvals/approver-set";
import type { ApprovalPayloadMap } from "@/modules/approvals/types";
import { sessions, twoFactor, userRoles, users } from "../../../drizzle/schema/auth";
import { partners } from "../../../drizzle/schema/users-ext";
import { productOwnershipLines, productOwnerships } from "../../../drizzle/schema/ownership";
import { leads } from "../../../drizzle/schema/leads";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import type { AdminUserChangePayload, AdminUserRow } from "./types";
import type {
  AdminUserChangeResult,
  changeAdminRoleSchema,
  inviteAdminSchema,
  ListAdminUsersInput,
  removeAdminSchema,
} from "./contracts";
import type { ListResult } from "@/modules/_shared/zod";
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

const ADMIN_ROLE_RANK: Record<string, number> = { super_admin: 3, admin: 2, staff: 1 };

/**
 * Admin users list (SCR-ADM-31 companion read; no numbered API row).
 *
 * Known gaps vs. a fully-populated screen (see the phase report):
 *  - `status` only ever comes back `"active"`, `"invited"` or `"pending_change"` — a `suspended`
 *    admin-class user (rare; admins aren't normally suspended) is shown as `active` because the
 *    component prop type has no `suspended` state.
 *  - `invited` rows are synthetic: an `admin.user_change` invite payload has no real user row
 *    until it is approved (the approval's `subjectId` is a fresh random id, not a user id), so the
 *    row's `id` is the approval request id rather than a user id.
 *  - A user with more than one admin-class role (not created by this UI) is shown once, under the
 *    highest-ranked role (`super_admin` > `admin` > `staff`).
 */
export async function listAdminUsers(
  ctx: RequestContext,
  _input: ListAdminUsersInput,
  database: DbOrTx,
): Promise<ListResult<AdminUserRow>> {
  assertPermission(ctx, "users.admin.manage");

  const roleRows = await database
    .select({ userId: userRoles.userId, roleKey: userRoles.roleKey })
    .from(userRoles)
    .where(inArray(userRoles.roleKey, ["super_admin", "admin", "staff"]));

  const roleByUser = new Map<string, "super_admin" | "admin" | "staff">();
  for (const r of roleRows) {
    const role = r.roleKey as "super_admin" | "admin" | "staff";
    const current = roleByUser.get(r.userId);
    if (!current || ADMIN_ROLE_RANK[role]! > ADMIN_ROLE_RANK[current]!) {
      roleByUser.set(r.userId, role);
    }
  }
  const userIds = [...roleByUser.keys()];

  if (userIds.length === 0) {
    return { items: [], total: 0, nextCursor: null };
  }

  const userRows = await database
    .select()
    .from(users)
    .where(and(inArray(users.id, userIds), inArray(users.status, ["active", "suspended"])));

  const partnerRows = await database.select().from(partners).where(inArray(partners.userId, userIds));
  const partnerByUser = new Map(partnerRows.map((p) => [p.userId, p]));
  const partnerIds = partnerRows.map((p) => p.id);

  const shareCountByPartner = new Map<string, number>();
  if (partnerIds.length > 0) {
    const shareRows = await database
      .select({
        partnerId: productOwnershipLines.partnerId,
        count: count(productOwnershipLines.ownershipId),
      })
      .from(productOwnershipLines)
      .innerJoin(productOwnerships, eq(productOwnershipLines.ownershipId, productOwnerships.id))
      .where(
        and(
          inArray(productOwnershipLines.partnerId, partnerIds),
          eq(productOwnerships.status, "active"),
        ),
      )
      .groupBy(productOwnershipLines.partnerId);
    for (const r of shareRows) shareCountByPartner.set(r.partnerId, Number(r.count));
  }

  const totpRows = await database
    .select({ userId: twoFactor.userId })
    .from(twoFactor)
    .where(and(inArray(twoFactor.userId, userIds), eq(twoFactor.verified, true)));
  const totpUsers = new Set(totpRows.map((r) => r.userId));

  const sessionRows = await database
    .select({ userId: sessions.userId, lastSignInAt: max(sessions.createdAt) })
    .from(sessions)
    .where(inArray(sessions.userId, userIds))
    .groupBy(sessions.userId);
  const lastSignInByUser = new Map(sessionRows.map((r) => [r.userId, r.lastSignInAt]));

  const pendingRows = await database
    .select()
    .from(approvalRequests)
    .where(and(eq(approvalRequests.type, "admin.user_change"), eq(approvalRequests.status, "pending")));

  const pendingByUser = new Map<string, string>();
  const inviteRows: AdminUserRow[] = [];
  for (const r of pendingRows) {
    const payload = r.payload as Record<string, unknown>;
    const op = (payload.op ?? payload.kind) as string | undefined;
    if (op === "invite") {
      inviteRows.push({
        id: r.id,
        name: String(payload.email ?? "Invited admin").split("@")[0] ?? "Invited admin",
        email: String(payload.email ?? ""),
        role: (payload.role as "super_admin" | "admin" | "staff") ?? "staff",
        totp: false,
        status: "invited",
        pendingApprovalId: r.id,
      });
    } else if (op === "change_role" || op === "remove") {
      const userId = payload.userId as string | undefined;
      if (userId) pendingByUser.set(userId, r.id);
    }
  }

  const items: AdminUserRow[] = userRows.map((u) => {
    const role = roleByUser.get(u.id) ?? "staff";
    const partner = partnerByUser.get(u.id);
    const pendingApprovalId = pendingByUser.get(u.id);
    const lastSignInAt = lastSignInByUser.get(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role,
      ...(partner
        ? {
            partner: {
              id: partner.id,
              displayName: partner.displayName,
              activeShares: shareCountByPartner.get(partner.id) ?? 0,
              active: partner.active,
            },
          }
        : {}),
      totp: totpUsers.has(u.id),
      ...(lastSignInAt ? { lastSignInAt: lastSignInAt.toISOString() } : {}),
      status: pendingApprovalId ? "pending_change" : "active",
      ...(pendingApprovalId ? { pendingApprovalId } : {}),
    };
  });

  const all = [...items, ...inviteRows].sort((a, b) => a.name.localeCompare(b.name));

  return { items: all, total: all.length, nextCursor: null };
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
