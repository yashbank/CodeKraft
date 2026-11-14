/**
 * Shared public-lead entry (server action + /api/leads): per-IP/email rate limit, then the
 * invisible bot guard (honeypot + time trap), then the normal validated createLead path.
 * A flagged bot gets a normal-looking success and nothing is stored.
 */
import { randomUUID } from "node:crypto";
import { type ActionResult, fail, ok } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";
import { type FormGuardInput, checkFormGuard } from "@/lib/form-guard";
import { checkClass } from "@/lib/rate-limit";
import { createLeadAction } from "./actions";
import type { LeadCreateResult } from "./types";

export async function submitPublicLead(
  raw: unknown,
  ctx: Context,
  ip: string | null,
  guard: FormGuardInput,
): Promise<ActionResult<LeadCreateResult>> {
  const rawEmail = (raw as { email?: unknown } | null)?.email;
  const email =
    typeof rawEmail === "string" && rawEmail.trim() ? rawEmail.trim().toLowerCase() : undefined;
  const limited = await checkClass("public_form", {
    ip: ip ?? "unknown",
    ...(email ? { email } : {}),
  });
  if (!limited.allowed) {
    return fail(
      new AppError(ErrorCode.RATE_LIMITED, undefined, {
        retryAfterMs: Math.max(0, limited.resetAt - Date.now()),
      }),
    );
  }
  if (checkFormGuard(guard) !== "ok") {
    return ok({ leadId: randomUUID() });
  }
  return createLeadAction(raw, ctx);
}
