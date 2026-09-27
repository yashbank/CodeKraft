/**
 * The signed-in admin as an `AdminUserRef` (id/name/email/role), for pages that need "me" —
 * approvals (requester-vs-approver), leads/queries "assign to me" defaults. Mirrors the same
 * `getSession()` + role derivation `(admin)/admin/layout.tsx` already does for the shell header;
 * there is no `usersService` method that returns name/email for an arbitrary admin id (see
 * `src/modules/approvals/approver-set.ts`'s `listActiveAdminUsers`), but the *caller's own*
 * name/email are already on their session, so no extra query is needed here.
 */
import { getSession } from "@/modules/auth/service";
import type { RequestContext } from "@/lib/authz/context";
import type { AdminUserRef } from "@/components/admin/types";

export async function getCurrentAdminUser(ctx: RequestContext): Promise<AdminUserRef> {
  const session = await getSession();
  const role: AdminUserRef["role"] = ctx.roles.includes("super_admin")
    ? "super_admin"
    : ctx.roles.includes("admin")
      ? "admin"
      : "staff";
  return {
    id: ctx.userId,
    name: session?.user.name || "Admin",
    email: session?.user.email,
    role,
  };
}
