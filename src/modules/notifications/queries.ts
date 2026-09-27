"use server";

/**
 * `notifications` read-only queries (API-NOTIF-01 `listNotifications`, PHASE-05).
 * Queries are `defineAction` reads that never mutate; the service reads the caller's own rows
 * (`ctx.userId`), so this is gated the same as any other "my account" read.
 *
 * `notificationsService` is imported lazily inside the handler (never a static top-level
 * import): `notifications/service.ts` pulls in `@/lib/db` at module scope, which throws in a
 * jsdom test environment (`src/lib/env.ts` guards against `window`) -- a static import here
 * would drag that into any client component that imports this file's sibling
 * `admin-mutations.ts`.
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { listNotificationsSchema } from "./types";

export const listNotificationsQuery = defineAction({
  name: "API-NOTIF-01 listNotifications",
  input: listNotificationsSchema,
  permission: "account.self",
  handler: async (input, ctx) => {
    const { notificationsService } = await import("./service");
    return notificationsService.listNotifications(ctx, input);
  },
});

export const getNotificationPreferencesQuery = defineAction({
  name: "API-NOTIF-04 notificationPreferences.get",
  input: z.strictObject({}),
  permission: "account.self",
  handler: async (_input, ctx) => {
    const { notificationsService } = await import("./service");
    return notificationsService.getNotificationPreferences(ctx);
  },
});
