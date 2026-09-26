/**
 * Builds a RequestContext for the signed-in admin-host user, for use in admin server
 * components (reads) and admin server-action wrappers (writes). Mirrors the pattern already
 * used by the admin layout (getSession + loadRoles -> buildContext).
 */
import { getSession } from "@/modules/auth/service";
import { loadRoles } from "@/modules/auth/roles-port";
import { buildContext, type RequestContext } from "./context";
import { AppError, ErrorCode } from "@/lib/errors";

export async function getAdminRequestContext(): Promise<RequestContext> {
  const session = await getSession();
  if (!session) throw new AppError(ErrorCode.UNAUTHENTICATED);

  const roles = await loadRoles(session.user.id);
  return buildContext({
    user: { id: session.user.id },
    session: { id: session.session.id },
    roles,
  });
}
