/**
 * Builds a RequestContext for the signed-in admin-host user, for use in admin server
 * components (reads) and admin server-action wrappers (writes). Mirrors the pattern already
 * used by the admin layout (getSession + loadRoles -> buildContext).
 */
import { getSession } from "@/modules/auth/service";
import { loadRoles } from "@/modules/auth/roles-port";
import { buildContext, type RequestContext } from "./context";
import { assertNoPasswordChange } from "./must-change";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partners } from "../../../drizzle/schema/users-ext";
import { AppError, ErrorCode } from "@/lib/errors";

export async function getAdminRequestContext(): Promise<RequestContext> {
  const session = await getSession();
  if (!session) throw new AppError(ErrorCode.UNAUTHENTICATED);
  assertNoPasswordChange(session);

  const roles = await loadRoles(session.user.id);
  // The signed-in admin's own partner row: "My share", own-ledger scoping and statements all
  // key off ctx.partnerId; without it every admin looked partner-less (share 0, wrong scope).
  const [partner] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.userId, session.user.id))
    .limit(1);
  return buildContext({
    user: { id: session.user.id },
    session: { id: session.session.id },
    roles,
    partnerId: partner?.id,
  });
}
