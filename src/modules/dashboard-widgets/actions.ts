"use server";

/**
 * `dashboard-widgets` Server Actions. Every export is created with `defineAction` /
 * `definePublicAction` (`tests/static/actions-use-define-action.test.ts`, SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import { allowedWidgetKeys } from "@/components/admin/dashboard/role-widgets";
import { AppError, ErrorCode } from "@/lib/errors";
import { saveAdminWidgetLayout, saveAdminWidgetLayoutSchema } from "./admin-layout";

/** R8-10 / API-ADM-13 — saves the caller's own widget selection + order (keyed by `ctx.userId`). */
export const saveAdminWidgetLayoutAction = defineAction({
  name: "API-ADM-13 dashboard.saveLayout",
  input: saveAdminWidgetLayoutSchema,
  permission: "dashboard.admin",
  handler: async (input, ctx) => {
    // P14-01 — role allow-list, enforced here and not only in the UI.
    const allowed = allowedWidgetKeys(ctx.roles);
    if (input.widgets.some((k) => !allowed.includes(k)))
      throw new AppError(ErrorCode.VALIDATION, "Widget not available for your role");
    return { widgets: await saveAdminWidgetLayout(ctx.userId, input.widgets) };
  },
});
