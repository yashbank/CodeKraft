"use server";

/**
 * Thin server-action wrapper around the settings module's `defineAction` mutation, so an admin
 * `"use client"` component can call it directly by name without constructing a `RequestContext`
 * itself. The `settings.write` permission check still happens inside `updateSettingsAction` —
 * this layer only supplies `ctx` and revalidates. Mirrors `src/modules/catalog/admin-mutations.ts`
 * / `src/modules/media/admin-mutations.ts`.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";

async function withCtx<T>(
  action: (raw: unknown, ctx: Context) => Promise<ActionResult<T>>,
  raw: unknown,
): Promise<ActionResult<T>> {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    const result = await action(raw, ctx);
    if (result.ok) {
      revalidatePath("/", "layout");
    }
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function updateSettings(raw: unknown) {
  const { updateSettingsAction } = await import("./actions");
  return withCtx(updateSettingsAction, raw);
}
