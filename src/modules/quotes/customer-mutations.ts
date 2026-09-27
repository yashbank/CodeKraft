"use server";

/**
 * Thin server-action wrapper around the quotes `defineAction` mutations, so the customer
 * `QuoteScreen` client component can call `acceptCustomQuote` directly by name. The permission
 * check (`commerce.self`) and the "only the invited customer" ownership check both still happen
 * inside the underlying action/service; this layer only supplies `ctx`. Lazy
 * `await import("./actions")` — `quotes/service.ts` does a static top-level import of `@/lib/db`,
 * which throws when evaluated in a browser/jsdom context (same pattern as
 * `queries/admin-mutations.ts`).
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

/** Accepts the quote — creates the order + a manual payment intent. Real money. */
export async function acceptCustomQuote(raw: unknown) {
  const { acceptCustomQuoteAction } = await import("./actions");
  return withCtx(acceptCustomQuoteAction, raw);
}
