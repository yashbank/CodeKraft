"use server";

/**
 * `dashboard-widgets` Server Actions. Every export is created with `defineAction` /
 * `definePublicAction` (`tests/static/actions-use-define-action.test.ts`, SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import { saveAdminWidgetLayout, saveAdminWidgetLayoutSchema } from "./admin-layout";

/** R8-10 / API-ADM-13 — saves the caller's own widget selection + order (keyed by `ctx.userId`). */
export const saveAdminWidgetLayoutAction = defineAction({
  name: "API-ADM-13 dashboard.saveLayout",
  input: saveAdminWidgetLayoutSchema,
  permission: "dashboard.admin",
  handler: async (input, ctx) => ({
    widgets: await saveAdminWidgetLayout(ctx.userId, input.widgets),
  }),
});
