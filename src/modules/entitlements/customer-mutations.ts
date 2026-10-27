"use server";

/**
 * Customer-side server-action wrappers for `entitlements` (R8-03), so the account
 * `EntitlementDetailScreen` can reveal its own licence key. Permission (`delivery.self`), the
 * owner check and the `key_reveal` rate limit all run inside the underlying action.
 */
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";

async function withCtx<T>(
  action: (raw: unknown, ctx: Context) => Promise<ActionResult<T>>,
  raw: unknown,
): Promise<ActionResult<T>> {
  try {
    const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
    const ctx = await getSiteRequestContext();
    return await action(raw, ctx);
  } catch (err) {
    return fail(err);
  }
}

export async function revealLicenseKey(raw: unknown) {
  const { revealLicenseKeyAction } = await import("./actions");
  return withCtx(revealLicenseKeyAction, raw);
}
