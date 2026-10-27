"use server";

/**
 * Thin server-action wrapper so the `"use client"` admin dashboard can persist its widget layout
 * without building a `RequestContext`. The `dashboard.admin` permission check and Zod validation
 * stay inside `saveAdminWidgetLayoutAction`. Mirrors `modules/settings/admin-mutations.ts`.
 */
import { fail } from "@/lib/actions/envelope";

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
