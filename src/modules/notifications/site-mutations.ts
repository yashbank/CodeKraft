"use server";

/**
 * Thin server-action wrappers around the notifications `defineAction` mutations, so the
 * customer-facing NotificationsScreen client component can call them directly by name without
 * constructing a RequestContext itself. Mirrors `src/modules/notifications/admin-mutations.ts`,
 * scoped to the signed-in customer instead of an admin.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";
import { markAllReadAction, markReadAction, updateNotificationPreferencesAction } from "./actions";

async function withSiteCtx<T>(
  action: (raw: unknown, ctx: Context) => Promise<ActionResult<T>>,
  raw: unknown,
  path: string = "/account/notifications",
): Promise<ActionResult<T>> {
  try {
    // Lazy import -- see `catalog/site-mutations.ts` for why.
    const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
    const ctx = await getSiteRequestContext();
    const result = await action(raw, ctx);
    if (result.ok) revalidatePath(path);
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function markMyNotificationRead(raw: unknown) {
  return withSiteCtx(markReadAction, raw);
}

export async function markAllMyNotificationsRead() {
  return withSiteCtx(markAllReadAction, {});
}

export async function updateMyNotificationPreferences(raw: unknown) {
  return withSiteCtx(updateNotificationPreferencesAction, raw, "/account/settings");
}
