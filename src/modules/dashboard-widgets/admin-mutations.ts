"use server";

/**
 * Thin server-action wrapper so the `"use client"` admin dashboard can persist its widget layout
 * without building a `RequestContext`. The `dashboard.admin` permission check and Zod validation
 * stay inside `saveAdminWidgetLayoutAction`. Mirrors `modules/settings/admin-mutations.ts`.
 */
import { fail, ok } from "@/lib/actions/envelope";
import type { DashboardData } from "@/components/admin/types";

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
    const { allowedWidgetKeys } = await import("@/components/admin/dashboard/role-widgets");
    if (!allowedWidgetKeys(ctx.roles).includes(input.widget))
      throw new AppError(ErrorCode.FORBIDDEN);
    const data = await loadDashboardData(ctx, input.range, [input.widget]);
    return ok({ widget: input.widget, data: pickWidgetData(input.widget, data) });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Batched refresh for the dashboard's 60-second timer: one call re-queries every widget on screen
 * (each loader still gates on its own permission) and returns the merged slices plus the server
 * time, so the "updated N min ago" stamp reflects when the data was actually read.
 */
export async function refreshDashboardWidgets(raw: unknown) {
  try {
    const { z } = await import("zod");
    const { ADMIN_WIDGET_KEYS } = await import("./admin-layout");
    const input = z
      .object({
        widgets: z.array(z.enum(ADMIN_WIDGET_KEYS)).min(1).max(ADMIN_WIDGET_KEYS.length),
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
    const { allowedWidgetKeys } = await import("@/components/admin/dashboard/role-widgets");
    const roleOk = new Set(allowedWidgetKeys(ctx.roles));
    const widgets = [...new Set(input.widgets)].filter((w) => roleOk.has(w));
    const data = await loadDashboardData(ctx, input.range, widgets);
    const merged: Partial<DashboardData> = {};
    for (const w of widgets) Object.assign(merged, pickWidgetData(w, data));
    return ok({ widgets, data: merged, at: new Date().toISOString() });
  } catch (err) {
    return fail(err);
  }
}
