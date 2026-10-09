"use server";

/**
 * Thin server-action wrappers around the quotes module's `defineAction` mutations, so the admin
 * `QuotesScreen` client component can call them directly by name without constructing a
 * `RequestContext` itself. Permission checks (`orders.manual.write`) still happen inside each
 * underlying action — this layer only supplies `ctx` and revalidates. Mirrors
 * `src/modules/catalog/admin-mutations.ts` / `src/modules/media/admin-mutations.ts`.
 *
 * Not a mirror of `src/modules/quotes/customer-mutations.ts` — that file wraps the *customer*
 * `acceptCustomQuoteAction` with `getSiteRequestContext` (the pay-link flow); this file wraps the
 * *admin* create/send/cancel actions with `getAdminRequestContext` instead.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";

async function withCtx<T>(
  pick: (
    actions: typeof import("./actions"),
  ) => (raw: unknown, ctx: Context) => Promise<ActionResult<T>>,
  raw: unknown,
): Promise<ActionResult<T>> {
  try {
    // Lazy import: keeps server-only auth/db code out of the module graph that client
    // components pull in for the "use server" RPC stub (matters for jsdom unit tests, which
    // don't get Next.js's server-action bundling split) — same reason catalog's/media's wrappers
    // lazy-import both the context helper and the actions module.
    const [{ getAdminRequestContext }, actions] = await Promise.all([
      import("@/lib/authz/admin-request-context"),
      import("./actions"),
    ]);
    const ctx = await getAdminRequestContext();
    const result = await pick(actions)(raw, ctx);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function createQuote(raw: unknown) {
  return withCtx((a) => a.createCustomQuoteAction, raw);
}

export async function sendQuote(raw: unknown) {
  return withCtx((a) => a.sendCustomQuoteAction, raw);
}

export async function cancelQuote(raw: unknown) {
  return withCtx((a) => a.cancelCustomQuoteAction, raw);
}
