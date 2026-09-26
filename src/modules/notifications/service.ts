import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { type TxCtx, getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { users, userRoles } from "../../../drizzle/schema/auth";
import {
  type Notification,
  emailOutbox,
  notifications,
} from "../../../drizzle/schema/notifications";
import { customerProfiles } from "../../../drizzle/schema/users-ext";
import type {
  EmitOptions,
  NotificationRecipient,
  NotificationsService,
} from "./contracts";
import { renderNotification } from "./templates";
import type {
  EmitResult,
  ListNotificationsInput,
  ListNotificationsResult,
  MarkReadInput,
  MarkReadResult,
  NotificationChannelName,
  NotificationItem,
  NotificationPayload,
  NotificationPreferences,
  NotificationTarget,
  NotificationType,
  PollNotificationsInput,
  PollNotificationsResult,
  UpdateNotificationPreferencesInput,
} from "./types";

export class DefaultNotificationsService implements NotificationsService {
  private _db?: any;
  constructor(db?: any) {
    this._db = db;
  }
  private get db(): any {
    return this._db ?? getDb();
  }

  async emit(
    target: NotificationTarget,
    type: NotificationType,
    payload: NotificationPayload,
    channels?: readonly NotificationChannelName[],
    tx: TxCtx = this.db,
    options?: EmitOptions,
  ): Promise<EmitResult> {
    const rendered = renderNotification(type, payload);
    const recipients: NotificationRecipient[] = [];

    if (target === "admins" || target === "super_admins") {
      const allowedRoles =
        target === "super_admins" ? ["super_admin"] : ["admin", "super_admin"];
      const adminUsers = await tx
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: userRoles.roleKey,
        })
        .from(users)
        .innerJoin(userRoles, eq(users.id, userRoles.userId))
        .where(
          and(
            eq(users.status, "active"),
            inArray(userRoles.roleKey, allowedRoles),
          ),
        );

      const map = new Map<string, NotificationRecipient>();
      for (const u of adminUsers) {
        if (options?.excludeUserId && u.id === options.excludeUserId) continue;
        if (!map.has(u.id)) {
          map.set(u.id, {
            userId: u.id,
            email: u.email,
            name: u.name,
            roles: [u.role],
            preferences: null,
          });
        } else {
          map.get(u.id)!.roles.push(u.role);
        }
      }
      recipients.push(...map.values());
    } else {
      const targetUserIds = Array.isArray(target) ? target : [target];
      if (targetUserIds.length > 0) {
        const foundUsers = await tx
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
          })
          .from(users)
          .where(inArray(users.id, targetUserIds));

        for (const u of foundUsers) {
          const profile = await tx
            .select()
            .from(customerProfiles)
            .where(eq(customerProfiles.userId, u.id))
            .limit(1);

          const rawPrefs = profile[0]?.notificationPrefs as any;
          const preferences: NotificationPreferences = {
            email: {
              orderUpdates: true,
              productUpdates: rawPrefs?.emailProductUpdates ?? true,
            },
          };

          recipients.push({
            userId: u.id,
            email: u.email,
            name: u.name,
            roles: ["customer"],
            preferences,
          });
        }
      }
    }

    const notificationIds: string[] = [];
    const emailOutboxIds: string[] = [];
    const recipientUserIds: string[] = [];

    for (const r of recipients) {
      recipientUserIds.push(r.userId);

      const isAdmin = r.roles.some((role) =>
        ["admin", "super_admin"].includes(role),
      );
      // Admin in-app only except lead.overdue_digest
      const canEmail =
        (!isAdmin || type === "lead.overdue_digest") &&
        (!channels || channels.includes("email"));

      const [inserted] = await tx
        .insert(notifications)
        .values({
          userId: r.userId,
          type,
          title: rendered.title,
          body: rendered.body,
          link: rendered.link,
          payload: payload as any,
          channelState: { inapp: "sent" },
        })
        .returning();

      notificationIds.push(inserted.id);

      if (canEmail && rendered.emailTemplate) {
        if (
          type === "product.updated" &&
          r.preferences?.email.productUpdates === false
        ) {
          // opted out
          continue;
        }

        const [outboxRow] = await tx
          .insert(emailOutbox)
          .values({
            toEmail: r.email,
            template: rendered.emailTemplate,
            payload: payload as any,
            priority: rendered.emailPriority ?? 5,
            status: "queued",
            attempts: 0,
          })
          .returning();

        emailOutboxIds.push(outboxRow.id);
      }
    }

    return {
      notificationIds,
      recipients: recipientUserIds,
      emailOutboxIds,
    };
  }

  async listNotifications(
    ctx: RequestContext,
    input: ListNotificationsInput,
  ): Promise<ListNotificationsResult> {
    if (!ctx.userId) {
      throw new AppError("UNAUTHORIZED", "Authentication required");
    }

    const conditions = [eq(notifications.userId, ctx.userId)];
    if (input.unreadOnly) {
      conditions.push(isNull(notifications.readAt));
    }

    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit((input.limit ?? 25) + 1);

    const hasNext = rows.length > (input.limit ?? 25);
    const items = hasNext ? rows.slice(0, input.limit ?? 25) : rows;

    const unreadCountResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.userId),
          isNull(notifications.readAt),
        ),
      );

    return {
      items: items.map(this.toItem),
      unreadCount: unreadCountResult[0]?.count ?? 0,
      nextCursor: hasNext ? items[items.length - 1].id : null,
    };
  }

  async pollNotifications(
    ctx: RequestContext,
    input: PollNotificationsInput,
  ): Promise<PollNotificationsResult> {
    if (!ctx.userId) {
      throw new AppError("UNAUTHORIZED", "Authentication required");
    }

    const sinceDate = new Date(input.since);
    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.userId),
          gt(notifications.createdAt, sinceDate),
        ),
      )
      .orderBy(desc(notifications.createdAt));

    const unreadCountResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.userId),
          isNull(notifications.readAt),
        ),
      );

    return {
      items: rows.map(this.toItem),
      unreadCount: unreadCountResult[0]?.count ?? 0,
      serverTime: new Date().toISOString(),
    };
  }

  async markRead(
    ctx: RequestContext,
    input: MarkReadInput,
  ): Promise<MarkReadResult> {
    if (!ctx.userId) {
      throw new AppError("UNAUTHORIZED", "Authentication required");
    }

    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, ctx.userId),
          inArray(notifications.id, input.notificationIds),
        ),
      );

    const unreadCountResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.userId),
          isNull(notifications.readAt),
        ),
      );

    return {
      unreadCount: unreadCountResult[0]?.count ?? 0,
    };
  }

  async markAllRead(ctx: RequestContext): Promise<MarkReadResult> {
    if (!ctx.userId) {
      throw new AppError("UNAUTHORIZED", "Authentication required");
    }

    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, ctx.userId),
          isNull(notifications.readAt),
        ),
      );

    return {
      unreadCount: 0,
    };
  }

  async getNotificationPreferences(
    ctx: RequestContext,
  ): Promise<NotificationPreferences> {
    if (!ctx.userId) {
      throw new AppError("UNAUTHORIZED", "Authentication required");
    }

    const rows = await this.db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, ctx.userId))
      .limit(1);

    const prefs = rows[0]?.notificationPrefs as any;
    return {
      email: {
        orderUpdates: true,
        productUpdates: prefs?.emailProductUpdates ?? true,
      },
    };
  }

  async updateNotificationPreferences(
    ctx: RequestContext,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    if (!ctx.userId) {
      throw new AppError("UNAUTHORIZED", "Authentication required");
    }

    await this.db
      .insert(customerProfiles)
      .values({
        userId: ctx.userId,
        notificationPrefs: {
          email: true,
          inapp: true,
          emailProductUpdates: input.email.productUpdates,
        },
      })
      .onConflictDoUpdate({
        target: customerProfiles.userId,
        set: {
          notificationPrefs: {
            email: true,
            inapp: true,
            emailProductUpdates: input.email.productUpdates,
          },
          updatedAt: new Date(),
        },
      });

    return {
      email: {
        orderUpdates: true,
        productUpdates: input.email.productUpdates,
      },
    };
  }

  private toItem(row: Notification): NotificationItem {
    return {
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      link: row.link,
      payload: (row.payload as NotificationPayload) ?? null,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export function createNotificationsService(db?: any): NotificationsService {
  return new DefaultNotificationsService(db);
}

export const notificationsService = new DefaultNotificationsService();

export function createNotImplementedNotificationsService(): NotificationsService {
  return createNotImplemented<NotificationsService>("notifications", "P6", {
    emit: "async",
    listNotifications: "async",
    pollNotifications: "async",
    markRead: "async",
    updatePreferences: "async",
    getPreferences: "async",
  });
}

