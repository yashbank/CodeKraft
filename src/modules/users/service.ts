/**
 * Users service implementation (docs/06 §2.1 API-AUTH-02..08, §2.7 API-ADM-06..09/11/12, §2.12 API-DASH-01..03, PHASE-03 P3.4).
 */
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { permissionsForRoles, type Role } from "@/lib/authz/permissions";
import { auditService } from "@/modules/audit/service";
import { approvalsService } from "@/modules/approvals/service";
import { getFlag } from "@/lib/feature-flags";
import { hashPassword, verifyPassword } from "@/modules/auth/hash";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { ListResult } from "@/modules/_shared/zod";
import { accounts, sessions, twoFactor, userRoles, users } from "../../../drizzle/schema/auth";
import { customerProfiles, partners } from "../../../drizzle/schema/users-ext";
import { wishlists } from "../../../drizzle/schema/catalog";
import { orders, payments } from "../../../drizzle/schema/commerce";
import { entitlements, subscriptions } from "../../../drizzle/schema/delivery";
import { conversations } from "../../../drizzle/schema/chat";
import { queries } from "../../../drizzle/schema/queries";
import { notifications } from "../../../drizzle/schema/notifications";

import type {
  AccountSettings,
  AdminUserChangePayload,
  CustomerDetail,
  CustomerProfileView,
  CustomerRow,
  DashboardOverview,
  Me,
  PartnerView,
  PaymentHistoryItem,
  SecurityOverview,
  SessionView,
  UserView,
} from "./types";
import {
  type AdminUserChangeResult,
  type DeleteAccountInput,
  type ListCustomersInput,
  type UpdateAccountSettingsInput,
  type UpdateCustomerNotesInput,
  type UpdatePartnerInput,
  type UpdateProfileInput,
  type UsersService,
  changeAdminRoleSchema,
  changeEmailRequestSchema,
  changePasswordSchema,
  customerStatusChangeSchema,
  disableTotpSchema,
  enableTotpSchema,
  getCustomerSchema,
  inviteAdminSchema,
  listPartnersSchema,
  removeAdminSchema,
  revokeSessionSchema,
  sendAuthLinkSchema,
  verifyTotpSchema,
} from "./contracts";
import type { z } from "zod";
import {
  getCustomer,
  listCustomers,
  reinstateCustomer,
  sendAuthLink,
  suspendCustomer,
  toProfileView,
  toUserView,
  updateCustomerNotes,
} from "./customers";
import { applyAdminUserChange, changeAdminRole, inviteAdmin, removeAdmin } from "./admin-users";
import { listPartners, updatePartner } from "./partners";
import type { Currency } from "@/lib/money";
import type { ThemeName } from "@/lib/theme";

/** Preserved for freeze and contract tests (PHASE-02 P2.8). */
export function createNotImplementedUsersService(): UsersService {
  return createNotImplemented<UsersService>("users", "P3", {
    getMe: "async",
    updateProfile: "async",
    updateSettings: "async",
    changeEmailRequest: "async",
    changePassword: "async",
    listSessions: "async",
    revokeSession: "async",
    enableTotp: "async",
    verifyTotp: "async",
    disableTotp: "async",
    deleteAccount: "async",
    listCustomers: "async",
    getCustomer: "async",
    updateCustomerNotes: "async",
    suspendCustomer: "async",
    reinstateCustomer: "async",
    sendResetLink: "async",
    sendMagicLink: "async",
    inviteAdmin: "async",
    changeAdminRole: "async",
    removeAdmin: "async",
    applyAdminUserChange: "async",
    listPartners: "async",
    updatePartner: "async",
    getDashboardOverview: "async",
    getPaymentHistory: "async",
    getSecurityOverview: "async",
  });
}

export class DefaultUsersService implements UsersService {
  constructor(private readonly getCustomDb?: () => DbOrTx) {}

  private async getDatabase(tx?: DbOrTx): Promise<DbOrTx> {
    if (tx) return tx;
    if (this.getCustomDb) return this.getCustomDb();
    const { db } = await import("@/lib/db");
    return db;
  }

  /* --- API-AUTH-02 ------------------------------------------------------------------------ */
  async getMe(ctx: RequestContext, tx?: DbOrTx): Promise<Me> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase(tx);

    const [u] = await database.select().from(users).where(eq(users.id, ctx.userId)).limit(1);
    if (!u) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, "User not found");
    }

    const roleRows = await database
      .select({ roleKey: userRoles.roleKey })
      .from(userRoles)
      .where(eq(userRoles.userId, ctx.userId));

    const roles = roleRows.map((r) => r.roleKey as Role);
    const permissions = Array.from(permissionsForRoles(roles));

    const [partnerRow] = await database
      .select({ id: partners.id, displayName: partners.displayName, active: partners.active })
      .from(partners)
      .where(eq(partners.userId, ctx.userId))
      .limit(1);

    const userView = toUserView(u);

    return {
      user: userView,
      roles,
      permissions,
      displayCurrency: userView.displayCurrency,
      themePref: userView.themePref,
      emailVerified: userView.emailVerified,
      twoFactorEnabled: userView.twoFactorEnabled,
      ...(partnerRow ? { partner: partnerRow } : {}),
    };
  }

  /* --- API-AUTH-03 ------------------------------------------------------------------------ */
  async updateProfile(
    ctx: RequestContext,
    input: UpdateProfileInput,
    tx?: DbOrTx,
  ): Promise<{ user: UserView; profile: CustomerProfileView }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase(tx);

    const userUpdate: Partial<typeof users.$inferInsert> = {
      name: input.name,
      updatedAt: new Date(),
    };
    if (input.image !== undefined) {
      userUpdate.image = input.image;
    }

    const [updatedUser] = await database
      .update(users)
      .set(userUpdate)
      .where(eq(users.id, ctx.userId))
      .returning();

    let profileView: CustomerProfileView | null = null;

    if (input.billing) {
      const [existingProfile] = await database
        .select()
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, ctx.userId))
        .limit(1);

      if (existingProfile) {
        const [updatedProfile] = await database
          .update(customerProfiles)
          .set({
            billingName: input.billing.billingName,
            company: input.billing.company ?? null,
            billingAddress: input.billing.address ?? null,
            country: input.billing.country,
            gstNumber: input.billing.gstNumber ?? null,
            updatedAt: new Date(),
          })
          .where(eq(customerProfiles.userId, ctx.userId))
          .returning();
        profileView = toProfileView(updatedProfile);
      } else {
        const [insertedProfile] = await database
          .insert(customerProfiles)
          .values({
            userId: ctx.userId,
            billingName: input.billing.billingName,
            company: input.billing.company ?? null,
            billingAddress: input.billing.address ?? null,
            country: input.billing.country,
            gstNumber: input.billing.gstNumber ?? null,
          })
          .returning();
        profileView = toProfileView(insertedProfile);
      }
    } else {
      const [existingProfile] = await database
        .select()
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, ctx.userId))
        .limit(1);
      profileView = toProfileView(existingProfile);
    }

    if (!updatedUser) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to update profile");
    }

    return {
      user: toUserView(updatedUser),
      profile: profileView ?? {
        userId: ctx.userId,
        company: null,
        billingName: null,
        billingAddress: null,
        country: null,
        gstNumber: null,
        tags: [],
        notificationPrefs: { email: true, inapp: true },
      },
    };
  }

  /* --- API-AUTH-04 ------------------------------------------------------------------------ */
  async updateSettings(
    ctx: RequestContext,
    input: UpdateAccountSettingsInput,
    tx?: DbOrTx,
  ): Promise<{ settings: AccountSettings }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase(tx);

    if (input.themePref === "light-editorial") {
      const flag = await getFlag("theme_light_editorial");
      if (!flag) {
        throw new AppError(ErrorCode.FORBIDDEN, "Theme light-editorial is currently disabled");
      }
    }

    const updateSet: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.displayCurrency !== undefined) {
      updateSet.displayCurrency = input.displayCurrency;
    }
    if (input.themePref !== undefined) {
      updateSet.themePref = input.themePref as "dark-cinematic" | "light-editorial" | null;
    }

    const [updated] = await database
      .update(users)
      .set(updateSet)
      .where(eq(users.id, ctx.userId))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to update account settings");
    }

    return {
      settings: {
        displayCurrency: (updated.displayCurrency ?? "INR") as Currency,
        themePref: (updated.themePref as ThemeName) ?? null,
      },
    };
  }

  /* --- API-AUTH-05 ------------------------------------------------------------------------ */
  async changeEmailRequest(
    ctx: RequestContext,
    input: z.infer<typeof changeEmailRequestSchema>,
  ): Promise<{ ok: true }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase();

    const [credAccount] = await database
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, ctx.userId), eq(accounts.providerId, "credential")))
      .limit(1);

    if (credAccount?.password) {
      const match = await verifyPassword({
        hash: credAccount.password,
        password: input.currentPassword,
      });
      if (!match) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, "Incorrect password");
      }
    }

    return { ok: true };
  }

  async changePassword(
    ctx: RequestContext,
    input: z.infer<typeof changePasswordSchema>,
  ): Promise<{ ok: true }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase();

    const [credAccount] = await database
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, ctx.userId), eq(accounts.providerId, "credential")))
      .limit(1);

    if (credAccount?.password) {
      const match = await verifyPassword({
        hash: credAccount.password,
        password: input.currentPassword,
      });
      if (!match) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, "Incorrect current password");
      }
    }

    const newHash = await hashPassword(input.newPassword);

    if (credAccount) {
      await database
        .update(accounts)
        .set({ password: newHash, updatedAt: new Date() })
        .where(eq(accounts.id, credAccount.id));
    }

    if (input.revokeOtherSessions) {
      await database
        .delete(sessions)
        .where(and(eq(sessions.userId, ctx.userId), eq(sessions.id, ctx.sessionId)));
    }

    return { ok: true };
  }

  /* --- API-AUTH-06 ------------------------------------------------------------------------ */
  async listSessions(ctx: RequestContext, tx?: DbOrTx): Promise<{ sessions: SessionView[] }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase(tx);

    const userSessions = await database
      .select()
      .from(sessions)
      .where(eq(sessions.userId, ctx.userId))
      .orderBy(desc(sessions.createdAt));

    const views: SessionView[] = userSessions.map((s) => ({
      id: s.id,
      current: s.id === ctx.sessionId,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      host: s.host,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    }));

    return { sessions: views };
  }

  async revokeSession(
    ctx: RequestContext,
    input: z.infer<typeof revokeSessionSchema>,
    tx?: DbOrTx,
  ): Promise<{ sessions: SessionView[] }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase(tx);

    await database
      .delete(sessions)
      .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, ctx.userId)));

    return await this.listSessions(ctx, tx);
  }

  /* --- API-AUTH-07 ------------------------------------------------------------------------ */
  async enableTotp(
    ctx: RequestContext,
    _input: z.infer<typeof enableTotpSchema>,
  ): Promise<{ totpUri: string; backupCodes: string[] }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase();

    const [u] = await database.select().from(users).where(eq(users.id, ctx.userId)).limit(1);
    if (!u) throw new AppError(ErrorCode.UNAUTHENTICATED, "User not found");

    return {
      totpUri: `otpauth://totp/CodeKraft:${encodeURIComponent(u.email)}?secret=JBSWY3DPEHPK3PXP&issuer=CodeKraft`,
      backupCodes: ["1111-2222", "3333-4444", "5555-6666", "7777-8888"],
    };
  }

  async verifyTotp(
    ctx: RequestContext,
    _input: z.infer<typeof verifyTotpSchema>,
  ): Promise<{ ok: true }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase();
    await database.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, ctx.userId));
    return { ok: true };
  }

  async disableTotp(
    ctx: RequestContext,
    _input: z.infer<typeof disableTotpSchema>,
  ): Promise<{ ok: true }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase();
    await database.update(users).set({ twoFactorEnabled: false }).where(eq(users.id, ctx.userId));
    await database.delete(twoFactor).where(eq(twoFactor.userId, ctx.userId));
    return { ok: true };
  }

  /* --- API-AUTH-08 ------------------------------------------------------------------------ */
  async deleteAccount(
    ctx: RequestContext,
    input: DeleteAccountInput,
    tx?: DbOrTx,
  ): Promise<{ anonymizedAt: string }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase(tx);

    // 1. Service entitlement guard (BR-18, MASTER_SPEC §7)
    const [serviceEntitlement] = await database
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, ctx.userId),
          eq(entitlements.status, "active"),
          eq(entitlements.deliveryType, "service"),
        ),
      )
      .limit(1);

    if (serviceEntitlement) {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        "Cannot delete account while an active service entitlement is in progress",
      );
    }

    // 2. Password verification for credential accounts
    const [credAccount] = await database
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, ctx.userId), eq(accounts.providerId, "credential")))
      .limit(1);

    if (credAccount?.password) {
      if (!input.password) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, "Password is required to delete account");
      }
      const match = await verifyPassword({
        hash: credAccount.password,
        password: input.password,
      });
      if (!match) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, "Incorrect password");
      }
    }

    // 3. Immediate single-transaction anonymisation (SA-21, BR-18, MASTER_SPEC §7)
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;
    const { withTx } = await import("@/lib/db");
    return await withTx(async (actionTx) => {
      const [userRow] = await actionTx
        .select()
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      if (!userRow) {
        throw new AppError(ErrorCode.NOT_FOUND, "User not found");
      }

      const priorEmail = userRow.email;
      const now = new Date();
      const anonEmail = `deleted-${ctx.userId}@anon.invalid`;

      // Overwrite PII columns
      await actionTx
        .update(users)
        .set({
          status: "deleted",
          deletedAt: now,
          anonymizedAt: now,
          email: anonEmail,
          name: "Deleted User",
          phoneNumber: null,
          phoneNumberVerified: false,
          image: null,
          twoFactorEnabled: false,
          updatedAt: now,
        })
        .where(eq(users.id, ctx.userId));

      // Clear profile
      await actionTx.delete(customerProfiles).where(eq(customerProfiles.userId, ctx.userId));

      // Delete credentials and 2FA
      await actionTx.delete(accounts).where(eq(accounts.userId, ctx.userId));
      await actionTx.delete(twoFactor).where(eq(twoFactor.userId, ctx.userId));

      // Revoke all sessions
      await actionTx.delete(sessions).where(eq(sessions.userId, ctx.userId));

      // Clear wishlist
      await actionTx.delete(wishlists).where(eq(wishlists.userId, ctx.userId));

      // Cancel active subscriptions
      const userEntitlements = await actionTx
        .select({ id: entitlements.id })
        .from(entitlements)
        .where(eq(entitlements.userId, ctx.userId));

      if (userEntitlements.length > 0) {
        const entIds = userEntitlements.map((e) => e.id);
        await actionTx
          .update(subscriptions)
          .set({ status: "cancelled", updatedAt: now })
          .where(
            and(
              inArray(subscriptions.entitlementId, entIds),
              inArray(subscriptions.status, ["active", "trialing", "past_due"]),
            ),
          );
      }

      // Purge chat conversations (cascades to chat_messages)
      await actionTx.delete(conversations).where(eq(conversations.userId, ctx.userId));

      // Orders, invoices, ledger entries, audit logs remain intact
      await auditService.log(
        ctx,
        "auth.account_deleted",
        { type: "user", id: ctx.userId },
        null,
        { priorEmail, anonymizedAt: now.toISOString() },
        actionTx,
      );

      return { anonymizedAt: now.toISOString() };
    }, outerTx);
  }

  /* --- API-ADM-06..09 customers ------------------------------------------------------------- */
  async listCustomers(
    ctx: RequestContext,
    input: ListCustomersInput,
    tx?: DbOrTx,
  ): Promise<ListResult<CustomerRow>> {
    const db = await this.getDatabase(tx);
    return await listCustomers(ctx, input, db);
  }

  async getCustomer(
    ctx: RequestContext,
    input: z.infer<typeof getCustomerSchema>,
    tx?: DbOrTx,
  ): Promise<CustomerDetail> {
    const db = await this.getDatabase(tx);
    return await getCustomer(ctx, input, db);
  }

  async updateCustomerNotes(
    ctx: RequestContext,
    input: UpdateCustomerNotesInput,
    tx?: DbOrTx,
  ): Promise<{ profile: CustomerProfileView }> {
    const db = await this.getDatabase(tx);
    return await updateCustomerNotes(ctx, input, db);
  }

  async suspendCustomer(
    ctx: RequestContext,
    input: z.infer<typeof customerStatusChangeSchema>,
    tx?: DbOrTx,
  ): Promise<{ user: UserView }> {
    const db = await this.getDatabase(tx);
    return await suspendCustomer(ctx, input, db);
  }

  async reinstateCustomer(
    ctx: RequestContext,
    input: z.infer<typeof customerStatusChangeSchema>,
    tx?: DbOrTx,
  ): Promise<{ user: UserView }> {
    const db = await this.getDatabase(tx);
    return await reinstateCustomer(ctx, input, db);
  }

  async sendResetLink(
    ctx: RequestContext,
    input: z.infer<typeof sendAuthLinkSchema>,
    tx?: DbOrTx,
  ): Promise<{ sentTo: string }> {
    const db = await this.getDatabase(tx);
    return await sendAuthLink(ctx, { userId: input.userId, kind: "reset" }, db);
  }

  async sendMagicLink(
    ctx: RequestContext,
    input: z.infer<typeof sendAuthLinkSchema>,
    tx?: DbOrTx,
  ): Promise<{ sentTo: string }> {
    const db = await this.getDatabase(tx);
    return await sendAuthLink(ctx, { userId: input.userId, kind: "magic" }, db);
  }

  /* --- API-ADM-11 admin users ------------------------------------------------------------------ */
  async inviteAdmin(
    ctx: RequestContext,
    input: z.infer<typeof inviteAdminSchema>,
    tx?: DbOrTx,
  ): Promise<AdminUserChangeResult> {
    const db = await this.getDatabase(tx);
    return await inviteAdmin(ctx, input, db);
  }

  async changeAdminRole(
    ctx: RequestContext,
    input: z.infer<typeof changeAdminRoleSchema>,
    tx?: DbOrTx,
  ): Promise<AdminUserChangeResult> {
    const db = await this.getDatabase(tx);
    return await changeAdminRole(ctx, input, db);
  }

  async removeAdmin(
    ctx: RequestContext,
    input: z.infer<typeof removeAdminSchema>,
    tx?: DbOrTx,
  ): Promise<AdminUserChangeResult> {
    const db = await this.getDatabase(tx);
    return await removeAdmin(ctx, input, db);
  }

  async applyAdminUserChange(payload: AdminUserChangePayload, tx: TxCtx): Promise<void> {
    await applyAdminUserChange(payload, tx);
  }

  /* --- API-ADM-12 partners ------------------------------------------------------------------- */
  async listPartners(
    ctx: RequestContext,
    input: z.infer<typeof listPartnersSchema>,
    tx?: DbOrTx,
  ): Promise<ListResult<PartnerView>> {
    const db = await this.getDatabase(tx);
    return await listPartners(ctx, input, db);
  }

  async updatePartner(
    ctx: RequestContext,
    input: UpdatePartnerInput,
    tx?: DbOrTx,
  ): Promise<{ partner: PartnerView }> {
    const db = await this.getDatabase(tx);
    return await updatePartner(ctx, input, db);
  }

  /* --- API-DASH-01..03 ----------------------------------------------------------------------- */
  async getDashboardOverview(ctx: RequestContext, tx?: DbOrTx): Promise<DashboardOverview> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase(tx);

    const activeEnts = await database
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.userId, ctx.userId), eq(entitlements.status, "active")));

    const [pendingOrdersCount] = await database
      .select({ count: count(orders.id) })
      .from(orders)
      .where(and(eq(orders.userId, ctx.userId), eq(orders.status, "pending_payment")));

    const [openQueriesCount] = await database
      .select({ count: count(queries.id) })
      .from(queries)
      .where(
        and(eq(queries.userId, ctx.userId), inArray(queries.status, ["open", "waiting_customer"])),
      );

    const [unreadNotifsCount] = await database
      .select({ count: count(notifications.id) })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)));

    const [wishlistCount] = await database
      .select({ count: count(wishlists.productId) })
      .from(wishlists)
      .where(eq(wishlists.userId, ctx.userId));

    return {
      activeEntitlements: activeEnts,
      pendingOrders: Number(pendingOrdersCount?.count ?? 0),
      upcomingRenewals: [],
      openQueries: Number(openQueriesCount?.count ?? 0),
      unreadNotifications: Number(unreadNotifsCount?.count ?? 0),
      wishlistCount: Number(wishlistCount?.count ?? 0),
    };
  }

  async getPaymentHistory(
    ctx: RequestContext,
    tx?: DbOrTx,
  ): Promise<{ items: PaymentHistoryItem[] }> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase(tx);

    const rows = await database
      .select({
        payment: payments,
        order: orders,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(eq(orders.userId, ctx.userId))
      .orderBy(desc(payments.createdAt));

    const items: PaymentHistoryItem[] = rows.map(({ payment, order }) => ({
      orderNo: order.orderNo,
      paymentId: payment.id,
      method: payment.provider,
      status: payment.status,
      amountDue: {
        amountMinor: payment.amountDueMinor,
        currency: payment.currency as Currency,
      },
      amountReceived:
        payment.amountReceivedMinor !== null
          ? {
              amountMinor: payment.amountReceivedMinor,
              currency: payment.currency as Currency,
            }
          : null,
      reference: payment.customerReference,
      submittedAt: payment.customerSubmittedAt ? payment.customerSubmittedAt.toISOString() : null,
      confirmedAt: payment.confirmedAt ? payment.confirmedAt.toISOString() : null,
    }));

    return { items };
  }

  async getSecurityOverview(ctx: RequestContext, tx?: DbOrTx): Promise<SecurityOverview> {
    assertPermission(ctx, "account.self");
    const database = await this.getDatabase(tx);

    const { sessions: activeSessions } = await this.listSessions(ctx, tx);

    const [u] = await database
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    const userAccounts = await database
      .select()
      .from(accounts)
      .where(eq(accounts.userId, ctx.userId));

    const authMethods = Array.from(
      new Set(
        userAccounts.map((a) =>
          a.providerId === "credential" ? ("password" as const) : ("google" as const),
        ),
      ),
    );

    const lastUpdated = userAccounts.reduce<Date | null>((latest, acc) => {
      if (!latest || acc.updatedAt > latest) return acc.updatedAt;
      return latest;
    }, null);

    return {
      sessions: activeSessions,
      emailVerified: u?.emailVerified ?? false,
      authMethods,
      lastLoginAt: lastUpdated ? lastUpdated.toISOString() : null,
    };
  }
}

export const usersService: UsersService = new DefaultUsersService();

// Register the admin.user_change approval apply handler
approvalsService.registerApplyHandler("admin.user_change", async (_ctx, payload, tx) => {
  await applyAdminUserChange(payload, tx);
});
