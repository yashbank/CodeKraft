/**
 * `notifications` Server Actions (PHASE-06 P6.1): API-NOTIF-03 `markRead` / `markAllRead` (own rows
 * only) and API-NOTIF-04 `updateNotificationPreferences` (`account.self`). Customer self-service
 * writes: not admin mutations, so no audit row (docs/06 §1.6) and no public cache tag is touched.
 */
import { defineAction } from "@/lib/actions/envelope";
import { notificationsService } from "./service";
import { markAllReadSchema, markReadSchema, updateNotificationPreferencesSchema } from "./types";

export const markRead = defineAction({
  name: "API-NOTIF-03 notifications.mark_read",
  input: markReadSchema,
  handler: (input, ctx) => notificationsService.markRead(ctx, input),
});

export const markAllRead = defineAction({
  name: "API-NOTIF-03 notifications.mark_all_read",
  input: markAllReadSchema,
  handler: (_input, ctx) => notificationsService.markAllRead(ctx),
});

export const updateNotificationPreferences = defineAction({
  name: "API-NOTIF-04 notifications.preferences.update",
  input: updateNotificationPreferencesSchema,
  permission: "account.self",
  handler: (input, ctx) => notificationsService.updateNotificationPreferences(ctx, input),
});
