"use server";

/**
 * Thin server-action wrapper around the catalog `toggleWishlist` `defineAction` mutation, so the
 * customer-facing WishlistScreen client component can call it directly by name without
 * constructing a RequestContext itself. The permission check (`account.self`) still happens
 * inside the underlying action -- this layer only supplies `ctx` and revalidates. Mirrors
 * `src/modules/catalog/admin-mutations.ts`, scoped to the signed-in customer instead of an admin.
 *
 * Both `./actions` and `@/lib/authz/site-request-context` are imported lazily inside the function
 * body, never at module top level: `catalog/actions.ts` pulls in `catalogService`
 * (`@/lib/db` at module scope), which throws in a jsdom test environment (`src/lib/env.ts` guards
 * against `window`) -- a static import here would drag that into any client component
 * (`WishlistScreen`) that imports this file, the same reasoning as
 * `notifications/queries.ts`'s header comment.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";

export async function toggleWishlist(
  raw: unknown,
): Promise<ActionResult<{ wishlisted: boolean }>> {
  try {
    const [{ getSiteRequestContext }, { toggleWishlistAction }] = await Promise.all([
      import("@/lib/authz/site-request-context"),
      import("./actions"),
    ]);
    const ctx = await getSiteRequestContext();
    const result = await toggleWishlistAction(raw, ctx);
    if (result.ok) revalidatePath("/account/wishlist");
    return result;
  } catch (err) {
    return fail(err);
  }
}
