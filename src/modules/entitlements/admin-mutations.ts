"use server";

/**
 * Thin server-action wrappers around the entitlements `defineAction` mutations, so the
 * `EntitlementsScreen` client component can call them directly by name. Permission checks
 * (`entitlements.admin`) still happen inside each underlying action; this layer only supplies
 * `ctx` and revalidates.
 *
 * `entitlements/service.ts` does a STATIC top-level value import of `@/lib/db` (`import { type
 * TxCtx, getDb, withTx } from "@/lib/db"`), which throws when evaluated in a browser/jsdom
 * context. Every wrapper below therefore imports `./actions` lazily inside the function body —
 * same pattern as `finance/admin-mutations.ts` / `leads/admin-mutations.ts`.
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

export async function grantEntitlementManual(raw: unknown) {
  const { grantEntitlementManualAction } = await import("./actions");
  return withCtx(grantEntitlementManualAction, raw);
}

export async function revokeEntitlement(raw: unknown) {
  const { revokeEntitlementAction } = await import("./actions");
  return withCtx(revokeEntitlementAction, raw);
}

export async function resetDownloadCount(raw: unknown) {
  const { resetDownloadCountAction } = await import("./actions");
  return withCtx(resetDownloadCountAction, raw);
}

export async function extendAccess(raw: unknown) {
  const { extendAccessAction } = await import("./actions");
  return withCtx(extendAccessAction, raw);
}
