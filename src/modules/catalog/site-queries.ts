"use server";

/**
 * Thin server-action wrapper around the catalog `listMyWishlist` `defineAction` query, for
 * client components that need just the signed-in customer's wishlisted product ids (the
 * product detail page's `OfferingPanel` heart control -- that page is otherwise
 * anonymous/cacheable, so the wishlist state is read in the browser the same way `OfferingPanel`
 * already reads the session, per its own header comment). Mirrors `site-mutations.ts`: returns
 * an empty list for anonymous visitors instead of erroring, and lazily imports `./queries` /
 * `@/lib/authz/site-request-context` so this file stays safe to import from client components
 * (`catalog/queries.ts` pulls in `catalogService` -> `@/lib/db` at module scope).
 */
import type { ActionResult } from "@/lib/actions/envelope";
import { ok, fail } from "@/lib/actions/envelope";

export async function getMyWishlistIds(): Promise<ActionResult<string[]>> {
  try {
    const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
    const ctx = await getSiteRequestContext().catch(() => null);
    if (!ctx) return ok([]);
    const { listMyWishlistQuery } = await import("./queries");
    const result = await listMyWishlistQuery({ limit: 100, displayCurrency: "INR" }, ctx);
    if (!result.ok) return result;
    return ok(result.data.items.map((item) => item.productId));
  } catch (err) {
    return fail(err);
  }
}
