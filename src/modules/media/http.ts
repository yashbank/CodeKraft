/**
 * Route-handler plumbing for `/api/files/*` (docs/06 §3 "Common": JSON bodies, the §1.4 error
 * object with the HTTP status, `X-Request-Id` echoed, `Cache-Control: no-store`). The context is
 * built the same way Server Actions get theirs: Better Auth session → `user_roles` per request
 * → `partners` for the D-512 scope.
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { type Context, anonymousContext, buildContext } from "@/lib/authz/context";
import { getDb } from "@/lib/db";
import { AppError, ErrorCode, toActionResult } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { moduleLogger } from "@/lib/logger";
import { partners } from "../../../drizzle/schema/users-ext";

const log = moduleLogger("files-api");

export function requestMeta(req: Request): { ip: string | null; userAgent: string | null; requestId: string } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip");
  return {
    ip: ip === undefined || ip === "" ? null : ip,
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id") ?? newId(),
  };
}

export async function contextFromRequest(req: Request): Promise<Context> {
  const meta = requestMeta(req);
  const [{ getSession }, { loadRoles }] = await Promise.all([
    import("@/modules/auth/service"),
    import("@/modules/auth/roles-port"),
  ]);
  const session = await getSession(req.headers);
  if (!session) return anonymousContext(meta);
  const roles = await loadRoles(session.user.id);
  const [partner] = await getDb()
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.userId, session.user.id))
    .limit(1);
  return buildContext({
    user: { id: session.user.id },
    session: { id: session.session.id },
    roles,
    partnerId: partner?.id ?? null,
    ...meta,
  });
}

export function jsonResponse(body: unknown, status: number, requestId: string): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
  });
}

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "Body must be JSON.", { fieldErrors: { _body: ["invalid JSON"] } });
  }
}

/** Run a handler and translate its outcome into the §1.4 envelope with the mapped status. */
export async function handleRoute(
  req: Request,
  fn: (ctx: Context) => Promise<unknown>,
): Promise<NextResponse> {
  const { requestId } = requestMeta(req);
  try {
    const ctx = await contextFromRequest(req);
    const data = await fn(ctx);
    return jsonResponse({ ok: true, data }, 200, requestId);
  } catch (err) {
    if (err instanceof AppError) {
      return jsonResponse(toActionResult(err), err.httpStatus, requestId);
    }
    log.error({ err, requestId }, "files route failed");
    return jsonResponse(toActionResult(err), 500, requestId);
  }
}
