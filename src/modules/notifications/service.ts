/**
 * `notifications` service (PHASE-06 P6.1) — master plan §5 `emit`, docs/06 §2.11 API-NOTIF-01..04,
 * docs/04 §7.5, D-707 (in-app primary), D-1002 (customer email), X-012 (admins in-app only, the
 * overdue digest being the single exception), D-1604 (WhatsApp behind a flag).
 *
 * `emit` runs inside the caller's domain transaction. It is deliberately defensive: unknown or
 * inactive user ids are ignored, every channel failure is recorded in `channel_state` instead of
 * thrown, and the whole fan-out runs in a savepoint so a failure can never poison the caller's
 * transaction — the caller always gets an `EmitResult` (possibly empty) back.
 */
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { ADMIN_CLASS_ROLES, type Role, isRole } from "@/lib/authz/permissions";
import { IST_OFFSET_MINUTES, istParts } from "@/lib/dates";
import { type Db, type DbOrTx, type TxCtx, getDb } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { getFlag } from "@/lib/feature-flags";
import { moduleLogger } from "@/lib/logger";
import { userRoles, users } from "../../../drizzle/schema/auth";
import { type Notification, notifications } from "../../../drizzle/schema/notifications";
import { type NotificationPrefs, customerProfiles } from "../../../drizzle/schema/users-ext";
import { type EmailChannel, createEmailChannel } from "./channels/email";
import { createInAppChannel } from "./channels/inapp";
import { type WhatsAppChannel, createWhatsAppChannel } from "./channels/whatsapp";
import type {
  EmitOptions,
  NotificationChannel,
  NotificationRecipient,
  NotificationsService,
} from "./contracts";
import { decodeCursor, paginate } from "./cursor";
import { type TxEmailOutbox, getEmailOutbox } from "./outbox";
import { toApiPreferences, toDbPreferences } from "./prefs";
import { renderNotification } from "./templates";
import {
  type EmitResult,
  type ListNotificationsInput,
  type ListNotificationsResult,
  type MarkReadInput,
  type MarkReadResult,
  NOTIFICATION_TYPES,
  type NotificationChannelName,
  type NotificationItem,
  type NotificationPayload,
  type NotificationPreferences,
  type NotificationTarget,
  type NotificationType,
  type PollNotificationsInput,
  type PollNotificationsResult,
  type UpdateNotificationPreferencesInput,
} from "./types";

const log = moduleLogger("notifications");

export interface NotificationsDeps {
  db: () => Db;
  outbox: TxEmailOutbox;
  inapp: NotificationChannel;
  email: EmailChannel;
  whatsapp: WhatsAppChannel;
  /** Resolves the `whatsapp_channel` flag once per emit (D-1604). */
  whatsappEnabled: () => Promise<boolean>;
  now: () => Date;
}

/** Default channel set when the caller passes none: in-app always, email when a template exists. */
export const DEFAULT_CHANNELS: readonly NotificationChannelName[] = ["inapp", "email"];
export const POLL_MAX_ITEMS = 100;
/** The only type for which admin-class recipients receive email (X-012, R-701). */
export const ADMIN_EMAIL_TYPES: readonly NotificationType[] = ["lead.overdue_digest"];

/** Start of the IST calendar day containing `now` (for `onceKey` dedup). */
export function startOfIstDay(now: Date): Date {
  const p = istParts(now);
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - IST_OFFSET_MINUTES * 60_000);
}

export function isAdminClass(roles: readonly string[]): boolean {
  return roles.some((r) => (ADMIN_CLASS_ROLES as readonly string[]).includes(r));
}

function toItem(row: Notification): NotificationItem {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    link: row.link,
    payload: (row.payload as NotificationPayload | null) ?? null,
    readAt: row.readAt === null ? null : row.readAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

async function unreadCountFor(handle: DbOrTx, userId: string): Promise<number> {
  const [row] = await handle
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  status: string;
}

export function createNotificationsService(deps: NotificationsDeps): NotificationsService {
  // -----------------------------------------------------------------------------------------
  // Recipient resolution
  // -----------------------------------------------------------------------------------------

  async function loadUsers(tx: DbOrTx, target: NotificationTarget): Promise<UserRow[]> {
    const base = { id: users.id, email: users.email, name: users.name, status: users.status };
    if (target === "admins" || target === "super_admins") {
      const roleKeys: Role[] = target === "admins" ? ["super_admin", "admin"] : ["super_admin"];
      const rows = await tx
        .selectDistinctOn([users.id], base)
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .where(and(inArray(userRoles.roleKey, roleKeys), eq(users.status, "active")));
      return rows;
    }
    const ids = Array.from(new Set(typeof target === "string" ? [target] : target));
    if (ids.length === 0) return [];
    return tx
      .select(base)
      .from(users)
      .where(and(inArray(users.id, ids), eq(users.status, "active")));
  }

  async function resolveRecipients(
    tx: DbOrTx,
    target: NotificationTarget,
    options: EmitOptions,
  ): Promise<NotificationRecipient[]> {
    const rows = (await loadUsers(tx, target)).filter((u) => u.id !== options.excludeUserId);
    if (rows.length === 0) return [];
    const ids = rows.map((u) => u.id);
    const [roleRows, prefRows] = await Promise.all([
      tx
        .select({ userId: userRoles.userId, roleKey: userRoles.roleKey })
        .from(userRoles)
        .where(inArray(userRoles.userId, ids)),
      tx
        .select({ userId: customerProfiles.userId, prefs: customerProfiles.notificationPrefs })
        .from(customerProfiles)
        .where(inArray(customerProfiles.userId, ids)),
    ]);
    const rolesByUser = new Map<string, string[]>();
    for (const r of roleRows) {
      if (!isRole(r.roleKey)) continue;
      const list = rolesByUser.get(r.userId) ?? [];
      list.push(r.roleKey);
      rolesByUser.set(r.userId, list);
    }
    const prefsByUser = new Map<string, NotificationPrefs>();
    for (const p of prefRows) prefsByUser.set(p.userId, p.prefs);
    return rows.map((u) => {
      const roles = rolesByUser.get(u.id) ?? [];
      const admin = isAdminClass(roles);
      return {
        userId: u.id,
        email: u.email,
        name: u.name === "" ? null : u.name,
        roles,
        preferences: admin ? null : toApiPreferences(prefsByUser.get(u.id)),
      };
    });
  }

  async function alreadyEmittedToday(
    tx: DbOrTx,
    userIds: readonly string[],
    type: NotificationType,
    onceKey: string,
    now: Date,
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await tx
      .select({ userId: notifications.userId })
      .from(notifications)
      .where(
        and(
          inArray(notifications.userId, [...userIds]),
          eq(notifications.type, type),
          sql`${notifications.payload}->>'onceKey' = ${onceKey}`,
          sql`${notifications.createdAt} >= ${startOfIstDay(now).toISOString()}::timestamptz`,
        ),
      );
    return new Set(rows.map((r) => r.userId));
  }

  function channelsFor(
    recipient: NotificationRecipient,
    type: NotificationType,
    requested: readonly NotificationChannelName[],
    hasEmailTemplate: boolean,
    whatsappOn: boolean,
  ): NotificationChannelName[] {
    const out: NotificationChannelName[] = ["inapp"]; // in-app always (D-707)
    const admin = isAdminClass(recipient.roles);
    if (
      requested.includes("email") &&
      hasEmailTemplate &&
      (!admin || ADMIN_EMAIL_TYPES.includes(type))
    ) {
      out.push("email");
    }
    if (requested.includes("whatsapp") && whatsappOn && deps.whatsapp.enabled()) out.push("whatsapp");
    return out;
  }

  // -----------------------------------------------------------------------------------------
  // emit
  // -----------------------------------------------------------------------------------------

  async function emitInSavepoint(
    tx: TxCtx,
    target: NotificationTarget,
    type: NotificationType,
    payload: NotificationPayload,
    channels: readonly NotificationChannelName[] | undefined,
    options: EmitOptions,
  ): Promise<EmitResult> {
    const now = deps.now();
    const empty: EmitResult = { notificationIds: [], recipients: [], emailOutboxIds: [] };
    if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
      log.warn({ type }, "emit: unknown notification type ignored");
      return empty;
    }
    let recipients = await resolveRecipients(tx, target, options);
    if (recipients.length === 0) return empty;

    const storedPayload: NotificationPayload =
      options.onceKey === undefined ? payload : { ...payload, onceKey: options.onceKey };
    if (options.onceKey !== undefined) {
      const seen = await alreadyEmittedToday(
        tx,
        recipients.map((r) => r.userId),
        type,
        options.onceKey,
        now,
      );
      recipients = recipients.filter((r) => !seen.has(r.userId));
      if (recipients.length === 0) return empty;
    }

    const rendered = renderNotification(type, payload);
    const requested = channels ?? options.channels ?? DEFAULT_CHANNELS;
    const whatsappOn = requested.includes("whatsapp") ? await deps.whatsappEnabled() : false;
    deps.whatsapp.setEnabled(whatsappOn);

    const inserted = await tx
      .insert(notifications)
      .values(
        recipients.map((r) => ({
          userId: r.userId,
          type,
          title: rendered.title,
          body: rendered.body,
          link: rendered.link,
          payload: storedPayload,
          channelState: {},
          createdAt: now,
        })),
      )
      .returning();

    const result: EmitResult = {
      notificationIds: inserted.map((n) => n.id),
      recipients: inserted.map((n) => n.userId),
      emailOutboxIds: [],
    };
    const byUser = new Map(recipients.map((r) => [r.userId, r] as const));
    for (const row of inserted) {
      const recipient = byUser.get(row.userId);
      if (recipient === undefined) continue;
      const active = channelsFor(
        recipient,
        type,
        requested,
        rendered.emailTemplate !== null,
        whatsappOn,
      );
      for (const name of active) {
        try {
          if (name === "inapp") await deps.inapp.deliver(row, rendered, recipient, tx);
          else if (name === "email") {
            const id = await deps.email.enqueue(row, rendered, recipient, tx);
            if (id !== null) result.emailOutboxIds.push(id);
          } else await deps.whatsapp.deliver(row, rendered, recipient, tx);
        } catch (err) {
          log.error({ err, channel: name, notificationId: row.id }, "channel delivery failed");
        }
      }
    }
    return result;
  }

  const emit: NotificationsService["emit"] = async (
    target,
    type,
    payload,
    channels,
    tx,
    options = {},
  ) => {
    try {
      // Savepoint: a failure here rolls back only the fan-out, never the caller's domain writes.
      return await tx.transaction((sp) =>
        emitInSavepoint(sp as TxCtx, target, type, payload, channels, options),
      );
    } catch (err) {
      log.error({ err, type }, "notifications.emit failed; caller transaction unaffected");
      return { notificationIds: [], recipients: [], emailOutboxIds: [] };
    }
  };

  // -----------------------------------------------------------------------------------------
  // Reads
  // -----------------------------------------------------------------------------------------

  async function listNotifications(
    ctx: RequestContext,
    input: ListNotificationsInput,
  ): Promise<ListNotificationsResult> {
    const db = deps.db();
    const cursor = decodeCursor(input.cursor);
    const conditions = [eq(notifications.userId, ctx.userId)];
    if (input.unreadOnly === true) conditions.push(isNull(notifications.readAt));
    if (cursor !== undefined) {
      const at = new Date(String(cursor.v));
      conditions.push(
        or(
          lt(notifications.createdAt, at),
          and(eq(notifications.createdAt, at), lt(notifications.id, cursor.id)),
        )!,
      );
    }
    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(input.limit + 1);
    const page = paginate(rows, input.limit, (r) => ({ v: r.createdAt.toISOString(), id: r.id }));
    return {
      items: page.items.map(toItem),
      unreadCount: await unreadCountFor(db, ctx.userId),
      nextCursor: page.nextCursor,
    };
  }

  async function pollNotifications(
    ctx: RequestContext,
    input: PollNotificationsInput,
  ): Promise<PollNotificationsResult> {
    const db = deps.db();
    const since = new Date(input.since);
    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.userId), gt(notifications.createdAt, since)))
      .orderBy(asc(notifications.createdAt), asc(notifications.id))
      .limit(POLL_MAX_ITEMS);
    return {
      items: rows.map(toItem),
      unreadCount: await unreadCountFor(db, ctx.userId),
      serverTime: deps.now().toISOString(),
    };
  }

  // -----------------------------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------------------------

  async function markRead(ctx: RequestContext, input: MarkReadInput): Promise<MarkReadResult> {
    const db = deps.db();
    const ids = Array.from(new Set(input.notificationIds));
    const owned = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.userId), inArray(notifications.id, ids)));
    if (owned.length !== ids.length) throw new AppError(ErrorCode.NOT_FOUND);
    await db
      .update(notifications)
      .set({ readAt: deps.now() })
      .where(
        and(
          eq(notifications.userId, ctx.userId),
          inArray(notifications.id, ids),
          isNull(notifications.readAt),
        ),
      );
    return { unreadCount: await unreadCountFor(db, ctx.userId) };
  }

  async function markAllRead(ctx: RequestContext): Promise<MarkReadResult> {
    const db = deps.db();
    await db
      .update(notifications)
      .set({ readAt: deps.now() })
      .where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)));
    return { unreadCount: 0 };
  }

  async function getNotificationPreferences(ctx: RequestContext): Promise<NotificationPreferences> {
    assertPermission(ctx, "account.self");
    const [row] = await deps
      .db()
      .select({ prefs: customerProfiles.notificationPrefs })
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, ctx.userId))
      .limit(1);
    return toApiPreferences(row?.prefs);
  }

  async function updateNotificationPreferences(
    ctx: RequestContext,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    assertPermission(ctx, "account.self");
    const db = deps.db();
    const [existing] = await db
      .select({ prefs: customerProfiles.notificationPrefs })
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, ctx.userId))
      .limit(1);
    const next = toDbPreferences(input, existing?.prefs);
    const now = deps.now();
    await db
      .insert(customerProfiles)
      .values({ userId: ctx.userId, notificationPrefs: next, updatedAt: now })
      .onConflictDoUpdate({
        target: customerProfiles.userId,
        set: { notificationPrefs: next, updatedAt: now },
      });
    return toApiPreferences(next);
  }

  return Object.freeze({
    emit,
    listNotifications,
    pollNotifications,
    markRead,
    markAllRead,
    getNotificationPreferences,
    updateNotificationPreferences,
  });
}

/** Process-wide defaults: DB outbox registered with the P1.8 transport, real channels, flag lookup. */
export function defaultNotificationsDeps(): NotificationsDeps {
  const outbox = getEmailOutbox();
  return {
    db: getDb,
    outbox,
    inapp: createInAppChannel(),
    email: createEmailChannel(outbox),
    whatsapp: createWhatsAppChannel(false),
    whatsappEnabled: () => getFlag("whatsapp_channel"),
    now: () => new Date(),
  };
}

export const notificationsService: NotificationsService = createNotificationsService(
  defaultNotificationsDeps(),
);
