"use server";

/**
 * Thin server-action wrappers around `modules/delivery`'s `defineAction` mutations, so the admin
 * delivery-tasks client component can call them directly by name without constructing a
 * `RequestContext` itself. Mirrors `src/modules/users/admin-mutations.ts`.
 *
 * Unlike `modules/users`, `modules/delivery/service.ts` does a STATIC top-level `@/lib/db` value
 * import, so every wrapper here imports `./actions` LAZILY inside the function body — a static
 * import would pull server-only db code into the module graph client components (and jsdom unit
 * tests) load.
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
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function completeDeliveryTask(raw: unknown) {
  const { completeDeliveryTaskAction } = await import("./actions");
  return withCtx(completeDeliveryTaskAction, raw);
}

export async function assignDeliveryTask(raw: unknown) {
  const { assignDeliveryTaskAction } = await import("./actions");
  return withCtx(assignDeliveryTaskAction, raw);
}
