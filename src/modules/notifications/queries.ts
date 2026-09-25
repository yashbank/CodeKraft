/**
 * `notifications` read-only queries (PHASE-06 P6.1): API-NOTIF-01 `listNotifications`, API-NOTIF-02
 * `pollNotifications` (also served by `GET /api/notifications`, docs/06 §3.8) and API-NOTIF-04
 * `getNotificationPreferences`. Reads never mutate and are exempt from the audit rule (docs/06 §1.6).
 */
import { defineAction } from "@/lib/actions/envelope";
import { notificationsService } from "./service";
import {
  listNotificationsSchema,
  pollNotificationsSchema,
  getNotificationPreferencesSchema,
} from "./types";

export const listNotifications = defineAction({
  name: "API-NOTIF-01 notifications.list",
  input: listNotificationsSchema,
  handler: (input, ctx) => notificationsService.listNotifications(ctx, input),
});

export const pollNotifications = defineAction({
  name: "API-NOTIF-02 notifications.poll",
  input: pollNotificationsSchema,
  handler: (input, ctx) => notificationsService.pollNotifications(ctx, input),
});

export const getNotificationPreferences = defineAction({
  name: "API-NOTIF-04 notifications.preferences.get",
  input: getNotificationPreferencesSchema,
  permission: "account.self",
  handler: (_input, ctx) => notificationsService.getNotificationPreferences(ctx),
});
