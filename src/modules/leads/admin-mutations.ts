"use server";

/**
 * Thin server-action wrappers around the leads `defineAction` mutations, so the `LeadsScreen` /
 * `LeadDetail` client components can call them directly by name. Permission checks
 * (`leads.write` / `leads.assign`) still happen inside each underlying action; this layer only
 * supplies `ctx` and revalidates.
 *
 * `leads/service.ts` does a STATIC top-level value import of `@/lib/db` (`import { type TxCtx,
 * getDb } from "@/lib/db"`), which pulls in `@/lib/env` and throws when evaluated in a
 * browser/jsdom context. Every wrapper below therefore imports `./actions` lazily inside the
 * function body (never a static top-level import) — same pattern as
 * `finance/admin-mutations.ts` / `coupons/admin-mutations.ts` — keeping this "use server" file's
 * client-side RPC stub free of server-only code.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";

async function withCtx<T>(
  action: (raw: unknown, ctx: Context) => Promise<ActionResult<T>>,
  raw: unknown,
): Promise<ActionResult<T>> {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    const result = await action(raw, ctx);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function createLeadManual(raw: unknown) {
  const { createLeadManualAction } = await import("./actions");
  return withCtx(createLeadManualAction, raw);
}

export async function assignLead(raw: unknown) {
  const { assignLeadAction } = await import("./actions");
  return withCtx(assignLeadAction, raw);
}

export async function claimLead(raw: unknown) {
  const { claimLeadAction } = await import("./actions");
  return withCtx(claimLeadAction, raw);
}

export async function updateLeadStatus(raw: unknown) {
  const { updateLeadStatusAction } = await import("./actions");
  return withCtx(updateLeadStatusAction, raw);
}

export async function addLeadNote(raw: unknown) {
  const { addLeadNoteAction } = await import("./actions");
  return withCtx(addLeadNoteAction, raw);
}

export async function setFollowUp(raw: unknown) {
  const { setFollowUpAction } = await import("./actions");
  return withCtx(setFollowUpAction, raw);
}
