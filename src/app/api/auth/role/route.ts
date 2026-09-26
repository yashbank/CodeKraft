import { NextResponse } from "next/server";

import { getSession } from "@/modules/auth/service";
import { hasAdminClassRole, loadRoles } from "@/modules/auth/roles-port";

/** Tells the shared LoginForm whether the just-authenticated user is admin-class, so a
 * site-host sign-in can hand admin/super_admin accounts off to the admin subdomain instead
 * of dropping them at /account (docs/09 §3). Never exposes the actual role list. */
export async function GET(req: Request) {
  const session = await getSession(req.headers);
  if (!session) return NextResponse.json({ isAdminClass: false });

  const roles = await loadRoles(session.user.id);
  return NextResponse.json({ isAdminClass: hasAdminClassRole(roles) });
}
