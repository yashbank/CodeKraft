"use server";

/**
 * Thin server-action wrapper around `getInvoicePdfUrlQuery`, so the customer-facing
 * InvoicesScreen client component can request a presigned PDF URL directly by name without
 * constructing a RequestContext itself. The query itself already enforces that a non-admin
 * caller only ever gets `NOT_FOUND` for an invoice/credit note they don't own (SA-10). Mirrors
 * `src/modules/catalog/admin-mutations.ts`'s `withCtx` shape, scoped to the signed-in customer.
 */
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";

export async function getMyInvoicePdfUrl(
  raw: unknown,
): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  try {
    // Lazy imports: `./queries` pulls in `invoicesService` (`@/lib/db` at module scope) statically,
    // which throws in a jsdom test environment (`src/lib/env.ts` guards against `window`) -- a
    // static import here would drag that into any client component that imports this file, the
    // same reasoning as `notifications/queries.ts`'s header comment.
    const [{ getSiteRequestContext }, { getInvoicePdfUrlQuery }] = await Promise.all([
      import("@/lib/authz/site-request-context"),
      import("./queries"),
    ]);
    const ctx = await getSiteRequestContext();
    return await getInvoicePdfUrlQuery(raw, ctx);
  } catch (err) {
    return fail(err);
  }
}
