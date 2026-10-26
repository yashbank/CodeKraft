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
import { createLeadAction } from "./actions";
import type { LeadCreateResult } from "./types";

export async function submitLead(raw: unknown): Promise<ActionResult<LeadCreateResult>> {
  let ctx: Context | null = await getSiteRequestContext().catch(() => null);
  if (!ctx) {
    const h = await headers();
    ctx = anonymousContext({
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    });
  }
  return createLeadAction(raw, ctx);
}
