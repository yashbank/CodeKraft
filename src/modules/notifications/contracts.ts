/**
 * Notifications service contract — master plan §5 `notifications.emit(userId | 'admins', type,
 * payload, channels)`, docs/06 §2.11 API-NOTIF-01..04, docs/04 §7.5, D-707, D-1002.
 * `emit` runs inside the caller's domain transaction (rows are committed with the domain writes).
 * Implementation in P6; `tests/stubs/notifications.ts` (P2.8) collects calls.
 */
import type { RequestContext } from "@/lib/authz/context";
import type { TxCtx } from "@/lib/db";
import type { EmailMessage, EmailOutboxPort } from "@/lib/email/types";
import type { Notification } from "../../../drizzle/schema/notifications";
import type {
  EmitResult,
  ListNotificationsInput,
  ListNotificationsResult,
  MarkReadInput,
  MarkReadResult,
  NotificationChannelName,
  NotificationPayload,
  NotificationPreferences,
  NotificationTarget,
  NotificationType,
  PollNotificationsInput,
  PollNotificationsResult,
  RenderedNotification,
  UpdateNotificationPreferencesInput,
} from "./types";

export interface EmitOptions {
  /** Explicit channels; default = `inapp` (+ `email` for customer types per D-1002). */
  channels?: readonly NotificationChannelName[];
  /** For `'admins'` targets: skip the acting admin (e.g. `entitlement.granted_manually` → "every other admin"). */
  excludeUserId?: string;
  /** Dedup key: when set, a second emit with the same key in the same IST day is a no-op (`chat.cap_reached`). */
  onceKey?: string;
}

export interface NotificationRecipient {
  userId: string;
  email: string;
  name: string | null;
  roles: readonly string[];
  /** Customer preferences (D-1002); admins have no email channel (X-012). */
  preferences: NotificationPreferences | null;
}

/** A delivery channel (`modules/notifications/channels/{inapp,email,whatsapp}`). */
export interface NotificationChannel {
  readonly name: NotificationChannelName;
  /** `false` disables the channel globally (feature flag for whatsapp). */
  enabled(): boolean;
  /**
   * Deliver one rendered notification to one recipient inside `tx`. Must never throw for
   * recipient-level problems (bounced, opted out) — record it in `channel_state` instead.
   */
  deliver(
    notification: Notification,
    rendered: RenderedNotification,
    recipient: NotificationRecipient,
    tx: TxCtx,
  ): Promise<void>;
}

/** The email channel: renders to `EmailMessage` and enqueues via the outbox (`src/lib/email/types.ts`). */
export interface EmailNotificationChannel extends NotificationChannel {
  readonly name: "email";
  readonly outbox: EmailOutboxPort;
  /** `null` when the type has no template or the recipient opted out (`productUpdates=false`). */
  toEmailMessage(
    notification: Notification,
    rendered: RenderedNotification,
    recipient: NotificationRecipient,
  ): EmailMessage | null;
}

export interface NotificationsService {
  /**
   * Master plan §5. Resolves `target` (`'admins'` = every active `super_admin`/`admin`,
   * `'super_admins'` = super admins only), inserts one `notifications` row per recipient and
   * fans out to channels inside `tx`. Never throws for channel failures (logged, `channel_state`).
   */
  emit(
    target: NotificationTarget,
    type: NotificationType,
    payload: NotificationPayload,
    channels: readonly NotificationChannelName[] | undefined,
    tx: TxCtx,
    options?: EmitOptions,
  ): Promise<EmitResult>;

  /** API-NOTIF-01 `listNotifications`. */
  listNotifications(
    ctx: RequestContext,
    input: ListNotificationsInput,
  ): Promise<ListNotificationsResult>;

  /** API-NOTIF-02 `pollNotifications` — rows created after `since`; rate class `poll`. */
  pollNotifications(
    ctx: RequestContext,
    input: PollNotificationsInput,
  ): Promise<PollNotificationsResult>;

  /** API-NOTIF-03 `markRead`. */
  markRead(ctx: RequestContext, input: MarkReadInput): Promise<MarkReadResult>;

  /** API-NOTIF-03 `markAllRead`. */
  markAllRead(ctx: RequestContext): Promise<MarkReadResult>;

  /** API-NOTIF-04 `getNotificationPreferences` — `account.self` (customer). */
  getNotificationPreferences(ctx: RequestContext): Promise<NotificationPreferences>;

  /** API-NOTIF-04 `updateNotificationPreferences` — `customer_profiles.notification_prefs`. */
  updateNotificationPreferences(
    ctx: RequestContext,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences>;
}
