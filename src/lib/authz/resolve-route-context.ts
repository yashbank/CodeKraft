/**
 * Resolve RequestContext / Context from Next.js route request headers — docs/06 §1.1.
 */
import { buildContext, anonymousContext, type Context } from "@/lib/authz/context";
import { getSession } from "@/modules/auth/service";
import { userRoles } from "../../../drizzle/schema/auth";
import { eq } from "drizzle-orm";

export async function resolveRouteContext(req: Request): Promise<Context> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = req.headers.get("user-agent") ?? undefined;

  // In test environments or mocked calls, allow test headers
  if (process.env.NODE_ENV === "test") {
    const testUserId = req.headers.get("x-test-user-id");
    if (testUserId) {
      const testRoles = req.headers.get("x-test-roles")?.split(",") ?? ["customer"];
      return buildContext({
        user: { id: testUserId },
        session: { id: req.headers.get("x-test-session-id") ?? "test-sess" },
        roles: testRoles,
        ip,
        userAgent,
      });
    }
  }

  try {
    const session = await getSession(req.headers);
    if (!session || !session.user) {
      return anonymousContext({ ip, userAgent });
    }

    const { db } = await import("@/lib/db");
    const roleRows = await db
      .select({ role: userRoles.roleKey })
      .from(userRoles)
      .where(eq(userRoles.userId, session.user.id));

    const roles = roleRows.length > 0 ? roleRows.map((r) => r.role) : ["customer"];

    return buildContext({
      user: { id: session.user.id },
      session: { id: session.session.id },
      roles,
      ip,
      userAgent,
    });
  } catch {
    return anonymousContext({ ip, userAgent });
  }
}
