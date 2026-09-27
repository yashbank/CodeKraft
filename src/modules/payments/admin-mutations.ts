"use server";

/**
 * Thin server-action wrappers around the payments `defineAction` mutations, so the admin orders
 * client components (OrdersList, OrderDetail) can call them directly by name without constructing
 * a RequestContext themselves. Permission checks (`payments.confirm` / `refunds.propose`) still
 * happen inside each underlying action -- this layer only supplies `ctx` and revalidates.
 *
 * `payments/service.ts` imports `@/lib/db` at the top level (value import, not type-only, unlike
 * `catalog/service.ts`), which pulls in `@/lib/env` and throws when evaluated in a browser/jsdom
 * context. Every wrapper below therefore imports `./actions` lazily inside the function body
 * (never a static top-level import), same as `proposeOwnershipSplit` below does for a
 * cross-module action -- this keeps this "use server" file's client-side RPC stub free of
 * server-only code, which matters for Vitest/jsdom unit tests of the client components that call
 * these.
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
    // Lazy import: keeps server-only auth/db code out of the module graph that client
    // components pull in for the "use server" RPC stub (matters for jsdom unit tests, which
    // don't get Next.js's server-action bundling split).
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    const result = await action(raw, ctx);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function confirmPayment(raw: unknown) {
  const { confirmPaymentAction } = await import("./actions");
  return withCtx(confirmPaymentAction, raw);
}

export async function failPayment(raw: unknown) {
  const { failPaymentAction } = await import("./actions");
  return withCtx(failPaymentAction, raw);
}

export async function proposeRefund(raw: unknown) {
  const { proposeRefundAction } = await import("./actions");
  return withCtx(proposeRefundAction, raw);
}
