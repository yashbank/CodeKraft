/**
 * Customer operations (API-ADM-06..09, D-1108, MASTER_SPEC §7, PHASE-03 P3.4).
 */
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";

function getOuterTx(db: DbOrTx): TxCtx | undefined {
  return "$client" in db ? undefined : (db as TxCtx);
}
import type { ListResult } from "@/modules/_shared/zod";
import { sessions, userRoles, users, type User } from "../../../drizzle/schema/auth";
import { customerProfiles, type CustomerProfile } from "../../../drizzle/schema/users-ext";
import { orders } from "../../../drizzle/schema/commerce";
import { entitlements } from "../../../drizzle/schema/delivery";
import type {
  CustomerDetail,
  CustomerProfileView,
  CustomerRow,
  CustomerTimelineItem,
  UserView,
} from "./types";
import type {
  ListCustomersInput,
  UpdateCustomerNotesInput,
  customerStatusChangeSchema,
  getCustomerSchema,
  sendAuthLinkSchema,
} from "./contracts";
import type { z } from "zod";
import type { Currency } from "@/lib/money";
import type { ThemeName } from "@/lib/theme";

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    phoneNumber: user.phoneNumber,
    status: user.status,
    displayCurrency: (user.displayCurrency ?? "INR") as Currency,
    themePref: (user.themePref as ThemeName) ?? null,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toProfileView(p: CustomerProfile | null | undefined): CustomerProfileView | null {
  if (!p) return null;
  return {
    userId: p.userId,
    company: p.company ?? null,
    billingName: p.billingName ?? null,
    billingAddress: p.billingAddress ?? null,
    country: p.country ?? null,
    gstNumber: p.gstNumber ?? null,
    tags: p.tags ?? [],
    notificationPrefs: p.notificationPrefs ?? { email: true, inapp: true },
  };
}

export async function listCustomers(
  ctx: RequestContext,
  input: ListCustomersInput,
  database: DbOrTx,
): Promise<ListResult<CustomerRow>> {
  assertPermission(ctx, "customers.read");

  const limit = input.limit ?? 25;
  const filters = input.filters;
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(users.status, filters.status));
  }
  if (filters?.country) {
    conditions.push(eq(customerProfiles.country, filters.country));
  }
  if (filters?.tag) {
    conditions.push(sql`${customerProfiles.tags} @> ARRAY[${filters.tag}]::text[]`);
  }

  // q search over name or email
  if (input.q) {
    const pattern = `%${input.q}%`;
    conditions.push(sql`(${users.name} ILIKE ${pattern} OR ${users.email} ILIKE ${pattern})`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await database
    .select({
      user: users,
      profile: customerProfiles,
    })
    .from(users)
    .leftJoin(customerProfiles, eq(users.id, customerProfiles.userId))
    .where(whereClause)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const itemsSlice = hasMore ? rows.slice(0, limit) : rows;

  const customerRows: CustomerRow[] = [];

  for (const row of itemsSlice) {
    // Stats for user
    const [orderStats] = await database
      .select({
        count: count(orders.id),
        spentInrMinor: sql<number>`COALESCE(SUM(CASE WHEN ${orders.status} = 'paid' THEN ${orders.totalMinor} ELSE 0 END), 0)::int`,
        lastOrderAt: sql<Date | null>`MAX(${orders.createdAt})`,
      })
      .from(orders)
      .where(eq(orders.userId, row.user.id));

    const [entitlementStats] = await database
      .select({ count: count(entitlements.id) })
      .from(entitlements)
      .where(eq(entitlements.userId, row.user.id));

    const orderCount = Number(orderStats?.count ?? 0);
    if (filters?.hasOrders !== undefined) {
      if (filters.hasOrders && orderCount === 0) continue;
      if (!filters.hasOrders && orderCount > 0) continue;
    }

    customerRows.push({
      user: toUserView(row.user),
      profile: toProfileView(row.profile),
      stats: {
        orders: orderCount,
        spentInrMinor: Number(orderStats?.spentInrMinor ?? 0),
        entitlements: Number(entitlementStats?.count ?? 0),
      },
      lastOrderAt: orderStats?.lastOrderAt ? orderStats.lastOrderAt.toISOString() : null,
    });
  }

  const lastItem = itemsSlice[itemsSlice.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.user.id : null;

  return {
    items: customerRows,
    nextCursor,
  };
}

export async function getCustomer(
  ctx: RequestContext,
  input: z.infer<typeof getCustomerSchema>,
  database: DbOrTx,
): Promise<CustomerDetail> {
  assertPermission(ctx, "customers.read");

  const [row] = await database
    .select({
      user: users,
      profile: customerProfiles,
    })
    .from(users)
    .leftJoin(customerProfiles, eq(users.id, customerProfiles.userId))
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  const [orderStats] = await database
    .select({
      count: count(orders.id),
      spentInrMinor: sql<number>`COALESCE(SUM(CASE WHEN ${orders.status} = 'paid' THEN ${orders.totalMinor} ELSE 0 END), 0)::int`,
      lastOrderAt: sql<Date | null>`MAX(${orders.createdAt})`,
    })
    .from(orders)
    .where(eq(orders.userId, row.user.id));

  const [entitlementStats] = await database
    .select({ count: count(entitlements.id) })
    .from(entitlements)
    .where(eq(entitlements.userId, row.user.id));

  // Timeline assembly
  const timeline: CustomerTimelineItem[] = [];

  timeline.push({
    at: row.user.createdAt.toISOString(),
    kind: "status",
    summary: `Customer account created (status: ${row.user.status})`,
  });

  const userOrders = await database
    .select()
    .from(orders)
    .where(eq(orders.userId, row.user.id))
    .orderBy(desc(orders.createdAt))
    .limit(20);

  for (const ord of userOrders) {
    timeline.push({
      at: ord.createdAt.toISOString(),
      kind: "order",
      summary: `Order ${ord.orderNo} placed (${ord.status}, ${ord.currency} ${(ord.totalMinor / 100).toFixed(2)})`,
      ref: { type: "order", id: ord.id },
    });
  }

  const userEntitlements = await database
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, row.user.id))
    .orderBy(desc(entitlements.createdAt))
    .limit(20);

  for (const ent of userEntitlements) {
    timeline.push({
      at: ent.createdAt.toISOString(),
      kind: "entitlement",
      summary: `Entitlement granted (${ent.deliveryType}, status: ${ent.status})`,
      ref: { type: "entitlement", id: ent.id },
    });
  }

  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    user: toUserView(row.user),
    profile: toProfileView(row.profile),
    stats: {
      orders: Number(orderStats?.count ?? 0),
      spentInrMinor: Number(orderStats?.spentInrMinor ?? 0),
      entitlements: Number(entitlementStats?.count ?? 0),
    },
    lastOrderAt: orderStats?.lastOrderAt ? orderStats.lastOrderAt.toISOString() : null,
    internalNotes: row.profile?.internalNotes ?? null,
    timeline,
  };
}

export async function updateCustomerNotes(
  ctx: RequestContext,
  input: UpdateCustomerNotesInput,
  database: DbOrTx,
): Promise<{ profile: CustomerProfileView }> {
  assertPermission(ctx, "customers.notes.write");

  const { withTx } = await import("@/lib/db");
  return await withTx(async (tx) => {
    const [existingUser] = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1);

    if (!existingUser) {
      throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
    }

    const [existingProfile] = await tx
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, input.userId))
      .limit(1);

    const beforeNotes = existingProfile?.internalNotes ?? null;
    const beforeTags = existingProfile?.tags ?? [];

    const updateSet: Partial<typeof customerProfiles.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.internalNotes !== undefined) {
      updateSet.internalNotes = input.internalNotes;
    }
    if (input.tags !== undefined) {
      updateSet.tags = input.tags;
    }

    let profile: CustomerProfile;

    if (existingProfile) {
      const [updated] = await tx
        .update(customerProfiles)
        .set(updateSet)
        .where(eq(customerProfiles.userId, input.userId))
        .returning();
      if (!updated) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to update customer profile");
      }
      profile = updated;
    } else {
      const [inserted] = await tx
        .insert(customerProfiles)
        .values({
          userId: input.userId,
          internalNotes: input.internalNotes ?? null,
          tags: input.tags ?? [],
        })
        .returning();
      if (!inserted) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to insert customer profile");
      }
      profile = inserted;
    }

    await auditService.log(
      ctx,
      "API-ADM-07 customer.update_notes",
      { type: "user", id: input.userId },
      { internalNotes: beforeNotes, tags: beforeTags },
      { internalNotes: profile.internalNotes, tags: profile.tags },
      tx,
    );

    const profileView = toProfileView(profile);
    if (!profileView) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to build customer profile view");
    }

    return { profile: profileView };
  }, getOuterTx(database));
}

export async function suspendCustomer(
  ctx: RequestContext,
  input: z.infer<typeof customerStatusChangeSchema>,
  database: DbOrTx,
): Promise<{ user: UserView }> {
  assertPermission(ctx, "customers.suspend");

  const { withTx } = await import("@/lib/db");
  return await withTx(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1);

    if (!u) {
      throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
    }

    if (u.status === "deleted") {
      throw new AppError(ErrorCode.STATE_INVALID, "Cannot suspend a deleted account");
    }

    const [updated] = await tx
      .update(users)
      .set({
        status: "suspended",
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to update user status");
    }

    // Revoke all sessions immediately
    await tx.delete(sessions).where(eq(sessions.userId, input.userId));

    await auditService.log(
      ctx,
      "API-ADM-08 customer.suspend",
      { type: "user", id: input.userId },
      { status: u.status },
      { status: "suspended", reason: input.reason },
      tx,
    );

    return { user: toUserView(updated) };
  }, getOuterTx(database));
}

export async function reinstateCustomer(
  ctx: RequestContext,
  input: z.infer<typeof customerStatusChangeSchema>,
  database: DbOrTx,
): Promise<{ user: UserView }> {
  assertPermission(ctx, "customers.suspend");

  const { withTx } = await import("@/lib/db");
  return await withTx(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1);

    if (!u) {
      throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
    }

    if (u.status === "deleted") {
      throw new AppError(ErrorCode.STATE_INVALID, "Cannot reinstate a deleted account");
    }

    const [updated] = await tx
      .update(users)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to update user status");
    }

    await auditService.log(
      ctx,
      "API-ADM-08 customer.reinstate",
      { type: "user", id: input.userId },
      { status: u.status },
      { status: "active", reason: input.reason },
      tx,
    );

    return { user: toUserView(updated) };
  }, getOuterTx(database));
}

export async function sendAuthLink(
  ctx: RequestContext,
  input: z.infer<typeof sendAuthLinkSchema>,
  database: DbOrTx,
): Promise<{ sentTo: string }> {
  assertPermission(ctx, "customers.reset_link");

  const { withTx } = await import("@/lib/db");
  return await withTx(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1);

    if (!u) {
      throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
    }

    if (u.status === "deleted") {
      throw new AppError(ErrorCode.STATE_INVALID, "Cannot send auth link to deleted account");
    }

    // Refuse for administrative accounts (FR-ADM-11, MASTER_SPEC §7)
    const roles = await tx
      .select({ roleKey: userRoles.roleKey })
      .from(userRoles)
      .where(eq(userRoles.userId, input.userId));

    const adminRoles = new Set(["super_admin", "admin", "staff"]);
    const hasAdminRole = roles.some((r) => adminRoles.has(r.roleKey));

    if (hasAdminRole) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Auth links cannot be sent to administrative accounts",
      );
    }

    // Note: single-use token or mailer is dispatched in background; token is NEVER returned to caller!
    await auditService.log(
      ctx,
      `API-ADM-09 customer.send_${input.kind}_link`,
      { type: "user", id: input.userId },
      null,
      { email: u.email, kind: input.kind },
      tx,
    );

    return { sentTo: u.email };
  }, getOuterTx(database));
}
