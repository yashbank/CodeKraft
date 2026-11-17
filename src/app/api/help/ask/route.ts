/** POST /api/help/ask — help assistant (P21). P22-1: staff, partners and admins only; customers and anonymous get 404 {mode:"off"}. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveRouteContext } from "@/lib/authz/resolve-route-context";
import { isAppError } from "@/lib/errors";
import { MINUTE_MS, rateLimit } from "@/lib/rate-limit";
import { answerQuestion, MAX_QUERY_CHARS } from "@/modules/help/answer";
import { getHelpConfig } from "@/modules/help/config";
import { findPartnerId, helpAllowed, helpRoleFromRoles } from "@/modules/help/role";

const MAX_BODY_BYTES = 2048;
const FLOOD_LIMIT = 40;

const bodySchema = z.strictObject({
  query: z.string().trim().min(1).max(MAX_QUERY_CHARS),
  locale: z.enum(["en", "hi"]).default("en"),
});

const err = (message: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error: message, ...extra }, { status });

export async function POST(req: Request) {
  try {
    // Role gate first: customers and anonymous visitors get nothing, before any other work.
    const ctx = await resolveRouteContext(req);
    const partnerId =
      ctx.partnerId ??
      (ctx.userId && !helpAllowed(helpRoleFromRoles(ctx.roles, undefined))
        ? await findPartnerId(ctx.userId)
        : undefined);
    const role = helpRoleFromRoles(ctx.roles, partnerId);
    if (!ctx.userId || !helpAllowed(role)) {
      return NextResponse.json({ mode: "off" }, { status: 404 });
    }

    const cfg = await getHelpConfig();
    if (!cfg.enabled) return NextResponse.json({ mode: "off" }, { status: 404 });

    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES)
      return err("Request too large", 413);
    const text = await req.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES)
      return err("Request too large", 413);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return err("Invalid request", 400);
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return err("Invalid request", 400);
    const { query, locale } = parsed.data;
    if (locale === "hi" && !cfg.hindi) return err("Language not available", 400);

    const subject = ctx.userId;
    const flood = await rateLimit(`help:ask:${subject}`, FLOOD_LIMIT, 10 * MINUTE_MS);
    if (!flood.allowed) {
      return err("Too many questions. Try again later.", 429, {
        retryAfterMs: Math.max(0, flood.resetAt - Date.now()),
      });
    }

    const result = await answerQuestion({
      query,
      locale,
      role,
      userId: ctx.userId,
      ip: ctx.ip ?? null,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    if (isAppError(caught)) return err(caught.message, caught.httpStatus);
    return err("Help is unavailable right now", 500);
  }
}
