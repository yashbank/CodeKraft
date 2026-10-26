"use server";

/**
 * Browser-callable wrapper for API-LEAD-01 `createLead`. `createLeadAction` needs a `Context`
 * argument, so it cannot be invoked from the client directly; this resolves the signed-in
 * customer context (if any) or an anonymous one, then delegates.
 */
import { headers } from "next/headers";
import type { ActionResult } from "@/lib/actions/envelope";
import { anonymousContext, type Context } from "@/lib/authz/context";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { fail } from "@/lib/actions/envelope";
import { AppError, ErrorCode } from "@/lib/errors";
import { checkClass } from "@/lib/rate-limit";
import { createLeadAction } from "./actions";
import type { LeadCreateResult } from "./types";

export async function submitLead(raw: unknown): Promise<ActionResult<LeadCreateResult>> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  let ctx: Context | null = await getSiteRequestContext().catch(() => null);
  if (!ctx) ctx = anonymousContext({ ip, userAgent: h.get("user-agent") });
  // public_form class (docs/06 §1.7): per-IP cap on top of Turnstile + honeypot in the service.
  const limited = await checkClass("public_form", { ip: ip ?? "unknown" });
  if (!limited.allowed) {
    return fail(
      new AppError(ErrorCode.RATE_LIMITED, undefined, {
        retryAfterMs: Math.max(0, limited.resetAt - Date.now()),
      }),
    );
  }
  return createLeadAction(raw, ctx);
}
