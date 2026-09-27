"use server";

/**
 * Thin server-action wrappers around the orders `defineAction` mutations, so the customer
 * `CheckoutScreen` client component can call them directly by name. Permission checks
 * (`commerce.self`) still happen inside each underlying action; this layer only supplies `ctx`.
 * Lazy `await import("./actions")` — `orders/service.ts` does a static top-level import of
 * `@/lib/db`, which throws when evaluated in a browser/jsdom context (same pattern as
 * `queries/admin-mutations.ts`).
 *
 * No `revalidatePath` here: `ORDERS_CACHE_TAGS` is empty (orders are private, `contracts.ts`) and
 * the checkout page reads nothing else server-rendered that a new order would change.
 */
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";

async function withCtx<T>(
  action: (raw: unknown, ctx: Context) => Promise<ActionResult<T>>,
  raw: unknown,
): Promise<ActionResult<T>> {
  try {
    const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
    const ctx = await getSiteRequestContext();
    return await action(raw, ctx);
  } catch (err) {
    return fail(err);
  }
}

/** Re-preview with a coupon code applied (or cleared) — used by the "Apply" button. */
export async function previewCheckout(raw: unknown) {
  const { previewCheckoutAction } = await import("./actions");
  return withCtx(previewCheckoutAction, raw);
}

/** Places the order — writes `orders(pending_payment)` + a manual payment intent. Real money. */
export async function createOrder(raw: unknown) {
  const { createOrderAction } = await import("./actions");
  return withCtx(createOrderAction, raw);
}
