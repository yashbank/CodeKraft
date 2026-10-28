"use server";

/**
 * Thin server-action wrapper so the `"use client"` admin dashboard can persist its widget layout
 * without building a `RequestContext`. The `dashboard.admin` permission check and Zod validation
 * stay inside `saveAdminWidgetLayoutAction`. Mirrors `modules/settings/admin-mutations.ts`.
 */
import { fail, ok } from "@/lib/actions/envelope";

export async function saveDashboardWidgets(raw: unknown) {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    const { saveAdminWidgetLayoutAction } = await import("./actions");
    return await saveAdminWidgetLayoutAction(raw, ctx);
  } catch (err) {
    return fail(err);
  }
}

/**
 * Per-widget refresh: re-runs the dashboard queries and returns only the slice(s) of data that
 * `widget` renders. Requires `dashboard.admin`; the individual loaders also gate on each widget's
 * own permission, so a refresh can never expose more than the page load does.
 */
export async function refreshDashboardWidget(raw: unknown) {
  try {
    const { z } = await import("zod");
    const { ADMIN_WIDGET_KEYS } = await import("./admin-layout");
    const input = z
      .object({
        widget: z.enum(ADMIN_WIDGET_KEYS),
        range: z.enum(["7d", "30d", "90d", "fy"]),
      })
      .strict()
      .parse(raw);
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const { can } = await import("@/lib/authz/assert");
    const { AppError, ErrorCode } = await import("@/lib/errors");
    const ctx = await getAdminRequestContext();
    if (!can(ctx, "dashboard.admin")) throw new AppError(ErrorCode.FORBIDDEN);
    const { loadDashboardData } = await import("@/lib/admin/dashboard-data");
    const { pickWidgetData } = await import("@/components/admin/dashboard/widget-data-keys");
    const data = await loadDashboardData(ctx, input.range);
    return ok({ widget: input.widget, data: pickWidgetData(input.widget, data) });
  } catch (err) {
    return fail(err);
  }
}
