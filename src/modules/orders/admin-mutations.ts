"use server";

/**
 * Thin server-action wrapper around the orders `defineAction` mutation used by the admin "New
 * manual order" form, so `ManualOrderForm` (a client component) can call it directly by name
 * without constructing a `RequestContext` itself. The permission check (`orders.manual.write`)
 * still happens inside the underlying action — this layer only supplies `ctx` and revalidates.
 *
 * Every other module under `src/modules/*` has an `admin-mutations.ts` of this shape (see
 * `content/admin-mutations.ts`, `payments/admin-mutations.ts`, `leads/admin-mutations.ts`) —
 * `orders` was the one module missing it, which is why the admin "+ New manual order" button
 * (`OrdersList.tsx`) pointed at `/admin/orders/new`, a route that never existed, and
 * `ManualOrderForm` (built as a `/dev/screens` preview only) never called the real backend.
 *
 * `orders/service.ts` does a static top-level value import of `@/lib/db` (same as
 * `payments/service.ts` / `leads/service.ts`), which throws when evaluated in a browser/jsdom
 * context — so `./actions` is imported lazily inside the function body, never at module top
 * level, keeping this "use server" file's client-side RPC stub free of server-only code.
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

export async function createManualOrder(raw: unknown) {
  const { createManualOrderAction } = await import("./actions");
  return withCtx(createManualOrderAction, raw);
}
