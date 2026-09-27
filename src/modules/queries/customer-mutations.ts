"use server";

/**
 * Thin server-action wrapper around the `queries` `defineAction` mutations, so the customer
 * `QueriesScreen` client component can call `createQuery` directly by name. The permission check
 * (`support.self`) still happens inside the underlying action; this layer only supplies `ctx`.
 * Lazy `await import("./actions")` — `queries/service.ts` does a static top-level import of
 * `@/lib/db`, which throws when evaluated in a browser/jsdom context (same pattern as
 * `queries/admin-mutations.ts`).
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
    const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
    const ctx = await getSiteRequestContext();
    const result = await action(raw, ctx);
    if (result.ok) revalidatePath("/account/queries");
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function createQuery(raw: unknown) {
  const { createQueryAction } = await import("./actions");
  return withCtx(createQueryAction, raw);
}
