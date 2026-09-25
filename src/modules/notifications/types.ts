/**
 * Notifications — docs/06 §2.11 API-NOTIF-01..04 (`modules/notifications`), §3.8
 * `GET /api/notifications`, docs/04 §7.5 (in-app polling 10 s admin / 30 s customer, email for
 * customer events + admin digest, channels `inapp | email | whatsapp(flag)`), D-707, D-1002, X-012.
 */
import { z } from "zod";
import { isoDateTimeSchema as isoDateTime, uuidSchema as uuid } from "@/modules/_shared/zod";
import type { EmailTemplate } from "@/lib/email/types";

export { uuidSchema as uuid, isoDateTimeSchema as isoDateTime } from "@/modules/_shared/zod";

/**
 * `notifications.type` — the list in docs/06 §2.11 (29 entries) plus `finance.reconcile_failed`
 * from the §3.3 cron table (`finance.reconcile`). PHASE-02 counts "28"; the docs list is authoritative.
 */
export const NOTIFICATION_TYPES = [
  "order.created",
  "order.paid",
  "payment.submitted",
  "payment.failed",
  "invoice.issued",
  "delivery.task",
  "service.progress",
  "license.ready",
  "subscription.reminder",
  "subscription.grace",
  "subscription.suspended",
  "subscription.cancelled",
  "refund.issued",
  "approval.requested",
  "approval.approved",
  "approval.rejected",
  "lead.new",
  "lead.assigned",
  "lead.overdue_digest",
  "query.new",
  "query.replied",
  "query.customer_replied",
  "product.published",
  "product.updated",
  "quote.sent",
  "entitlement.granted_manually",
  "chat.cap_reached",
  "system.job_failed",
  "system.fx_stale",
  "finance.reconcile_failed",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export const NOTIFICATION_CHANNELS = ["inapp", "email", "whatsapp"] as const;
export type NotificationChannelName = (typeof NOTIFICATION_CHANNELS)[number];

/** `emit` target (master plan §5): one user, several users, or every admin-class user. */
export const notificationTargetSchema = z.union([
  uuid,
  z.array(uuid).min(1).max(500),
  z.literal("admins"),
  z.literal("super_admins"),
]);
export type NotificationTarget = z.infer<typeof notificationTargetSchema>;

/** Stored on `notifications.payload`; `title`/`body`/`link` are derived per type by the service. */
export const notificationPayloadSchema = z.record(z.string().min(1).max(64), z.unknown());
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

/** Input of `NotificationsService.emit` (validated in tests/stubs; services call it typed). */
export const emitNotificationSchema = z
  .object({
    target: notificationTargetSchema,
    type: notificationTypeSchema,
    payload: notificationPayloadSchema,
    channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1).optional(),
  })
  .strict();
export type EmitNotificationInput = z.infer<typeof emitNotificationSchema>;

/** API-NOTIF-01 `listNotifications` — any session; own rows. */
export const listNotificationsSchema = z
  .object({
    unreadOnly: z.boolean().optional(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .strict();
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

/** API-NOTIF-02 `pollNotifications` — `GET /api/notifications?since=<ISO>`; rate class `poll`. */
export const pollNotificationsSchema = z.object({ since: isoDateTime }).strict();
export type PollNotificationsInput = z.infer<typeof pollNotificationsSchema>;

/** API-NOTIF-03 `markRead` — own rows only; `NOT_FOUND` otherwise. */
export const markReadSchema = z.object({ notificationIds: z.array(uuid).min(1).max(200) }).strict();
export type MarkReadInput = z.infer<typeof markReadSchema>;

/** API-NOTIF-03 `markAllRead`. */
export const markAllReadSchema = z.object({}).strict();
export type MarkAllReadInput = z.infer<typeof markAllReadSchema>;

/** API-NOTIF-04 `getNotificationPreferences` (read; no input). P6.1 additive fix: `defineAction` needs a schema. */
export const getNotificationPreferencesSchema = z.object({}).strict();
export type GetNotificationPreferencesInput = z.infer<typeof getNotificationPreferencesSchema>;

/**
 * API-NOTIF-04 preferences (`customer_profiles.notification_prefs`): `orderUpdates` is locked on,
 * `marketing` is absent in R1 (always false). Admin channel is in-app only (X-012).
 */
export const notificationPreferencesSchema = z
  .object({
    email: z
      .object({
        orderUpdates: z.literal(true),
        productUpdates: z.boolean(),
        marketing: z.literal(false).optional(),
      })
      .strict(),
  })
  .strict();
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const updateNotificationPreferencesSchema = notificationPreferencesSchema;
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

// ---------------------------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------------------------

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  payload: NotificationPayload | null;
  readAt: string | null;
  createdAt: string;
}

export interface ListNotificationsResult {
  items: NotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
}

export interface PollNotificationsResult {
  items: NotificationItem[];
  unreadCount: number;
  serverTime: string;
}

export interface MarkReadResult {
  unreadCount: number;
}

export interface EmitResult {
  /** One `notifications` row per resolved recipient (deduplicated; the acting admin is excluded for `'admins'` targets when `excludeUserId` is given). */
  notificationIds: string[];
  recipients: string[];
  /** Emails enqueued through `EmailOutboxPort` for the `email` channel. */
  emailOutboxIds: string[];
}

/** Rendered per type by the service (title/body/link map lives in P6 `templates.ts`). */
export interface RenderedNotification {
  title: string;
  body: string | null;
  link: string | null;
  /** Email template for the `email` channel, `null` when the type is in-app only. */
  emailTemplate: EmailTemplate | null;
  /** 1 urgent … 9 digest (`email_outbox.priority`). */
  emailPriority: number;
}
