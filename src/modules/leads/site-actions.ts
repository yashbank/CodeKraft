"use server";

/**
 * Browser-callable wrapper for API-LEAD-01 `createLead`. `createLeadAction` needs a `Context`
 * argument, so it cannot be invoked from the client directly; this resolves the signed-in
 * customer context (if any) or an anonymous one, then delegates to the shared guarded path
 * (rate limit, honeypot, time trap) in `public-submit.ts`.
 */
import { headers } from "next/headers";
import type { ActionResult } from "@/lib/actions/envelope";
import { anonymousContext, type Context } from "@/lib/authz/context";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { submitPublicLead } from "./public-submit";
import type { LeadCreateResult } from "./types";

export async function submitLead(
  raw: unknown,
  guard?: { honeypot?: string; token?: string | null },
): Promise<ActionResult<LeadCreateResult>> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  let ctx: Context | null = await getSiteRequestContext().catch(() => null);
  if (!ctx) ctx = anonymousContext({ ip, userAgent: h.get("user-agent") });
  return submitPublicLead(raw, ctx, ip, guard ?? {});
}
