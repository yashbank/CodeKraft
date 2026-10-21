"use server";

/**
 * Admin "Test connection" Server Action for Razorpay (V1.1, D-501) — settings UI only, TEST MODE
 * ONLY. `settings.write`-gated (same permission `updateSettingsAction` uses), CSRF-protected by
 * Next.js's built-in Server Action origin check (no extra plumbing needed). See
 * `razorpay-test-connection-core.ts` for the actual check (kept out of this file: a `"use
 * server"` file may only export async functions).
 */
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/envelope";
import { defineAction, fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";
import { runRazorpayTestConnection } from "./razorpay-test-connection-core";

export const testRazorpayConnectionAction = defineAction({
  name: "settings.razorpay.test_connection",
  permission: "settings.write",
  input: z.object({}).strict(),
  handler: async () => {
    await runRazorpayTestConnection();
    return { ok: true as const };
  },
});

async function withCtx<T>(
  action: (raw: unknown, ctx: Context) => Promise<ActionResult<T>>,
  raw: unknown,
): Promise<ActionResult<T>> {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    return await action(raw, ctx);
  } catch (err) {
    return fail(err);
  }
}

/** Client-callable wrapper (mirrors `admin-mutations.ts`'s `updateSettings`) — no input. */
export async function testRazorpayConnection() {
  return withCtx(testRazorpayConnectionAction, {});
}
