"use server";

/**
 * `notifications` Server Actions (API-NOTIF-03 `markRead` / `markAllRead`, PHASE-05).
 * All actions are wrapped in defineAction (SA-07).
 *
 * `notificationsService` is imported lazily inside each handler (never a static top-level
 * import) -- see the comment in `./queries.ts` for why.
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { markReadSchema, updateNotificationPreferencesSchema } from "./types";

export const markReadAction = defineAction({
  name: "API-NOTIF-03 markRead",
  input: markReadSchema,
  permission: "account.self",
  handler: async (input, ctx) => {
    const { notificationsService } = await import("./service");
    return notificationsService.markRead(ctx, input);
  },
});

export const markAllReadAction = defineAction({
  name: "API-NOTIF-03 markAllRead",
  input: z.strictObject({}),
  permission: "account.self",
  handler: async (_input, ctx) => {
    const { notificationsService } = await import("./service");
    return notificationsService.markAllRead(ctx);
  },
});

export const updateNotificationPreferencesAction = defineAction({
  name: "API-NOTIF-04 notificationPreferences.update",
  input: updateNotificationPreferencesSchema,
  permission: "account.self",
  handler: async (input, ctx) => {
    const { notificationsService } = await import("./service");
    return notificationsService.updateNotificationPreferences(ctx, input);
  },
});
