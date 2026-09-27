"use server";

/**
 * Thin server-action wrappers around the notifications `defineAction` mutations, so the admin
 * NotificationsInbox client component can call them directly by name without constructing a
 * RequestContext itself. Mirrors `src/modules/catalog/admin-mutations.ts`.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";
import { markAllReadAction, markReadAction } from "./actions";

async function withCtx<T>(
  action: (raw: unknown, ctx: Context) => Promise<ActionResult<T>>,
  raw: unknown,
): Promise<ActionResult<T>> {
  try {
    // Lazy import: keeps server-only auth/db code out of the module graph that client
    // components pull in for the "use server" RPC stub (matters for jsdom unit tests, which
    // don't get Next.js's server-action bundling split).
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    const result = await action(raw, ctx);
    if (result.ok) revalidatePath("/admin/notifications");
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function markNotificationsRead(raw: unknown) {
  return withCtx(markReadAction, raw);
}

export async function markAllNotificationsRead() {
  return withCtx(markAllReadAction, {});
}
