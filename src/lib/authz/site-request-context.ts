/**
 * Builds a RequestContext for the signed-in site (customer) user, for use in customer-facing
 * server components (reads) and customer server-action wrappers (writes) under the site host.
 * Mirrors `admin-request-context.ts`'s pattern (getSession + loadRoles -> buildContext), scoped
 * to the customer rather than requiring an admin-class role.
 *
 * Defaults to the `customer` role when the user has no `user_roles` rows (the common case: only
 * bootstrap admin emails get a role row inserted on sign-up, per `modules/auth/hooks.ts`) so
 * `account.self` / `commerce.self` / `delivery.self` / `support.self` gated "my ..." actions
 * work for ordinary signed-in customers. Mirrors `resolveRouteContext`'s same fallback.
 */
import { getSession } from "@/modules/auth/service";
import { loadRoles } from "@/modules/auth/roles-port";
import { buildContext, type RequestContext } from "./context";
import { AppError, ErrorCode } from "@/lib/errors";

export async function getSiteRequestContext(): Promise<RequestContext> {
  const session = await getSession();
  if (!session) throw new AppError(ErrorCode.UNAUTHENTICATED);

  const loadedRoles = await loadRoles(session.user.id);
  const roles = loadedRoles.length > 0 ? loadedRoles : (["customer"] as const);
  return buildContext({
    user: { id: session.user.id },
    session: { id: session.session.id },
    roles,
  });
}
