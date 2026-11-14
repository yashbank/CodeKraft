import { NextResponse, type NextRequest } from "next/server";

import { getSitePhase } from "@/lib/site-phase-server";

export const dynamic = "force-dynamic";

/**
 * Tiny internal probe for the edge middleware and the storefront banner (neither can read the
 * database). Public and harmless: the phase is visible to every visitor anyway. For
 * `maintenance`, a request carrying a session cookie also learns whether that session is an
 * admin-area user (`staff: true`) so admins can keep browsing the storefront.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const phase = await getSitePhase();
  let staff = false;
  if (phase === "maintenance" && req.headers.get("cookie")?.includes("session_token")) {
    try {
      const [{ getSession }, { hasAdminClassRole, loadRoles }] = await Promise.all([
        import("@/modules/auth/service"),
        import("@/modules/auth/roles-port"),
      ]);
      const session = await getSession();
      if (session) staff = hasAdminClassRole(await loadRoles(session.user.id));
    } catch {
      staff = false;
    }
  }
  return NextResponse.json({ phase, staff }, { headers: { "Cache-Control": "no-store" } });
}
