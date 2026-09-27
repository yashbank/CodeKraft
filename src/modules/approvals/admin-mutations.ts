"use server";

/**
 * Thin server-action wrappers around the approvals `defineAction` mutations (API-ADM-02..04), so
 * the `ApprovalsInbox` client component can call them directly by name. Permission checks
 * (`approvals.decide`) still happen inside each underlying action; this layer only supplies
 * `ctx` and revalidates. `approvals/service.ts` already lazy-imports `@/lib/db` internally (see
 * its top-level `DbOrTx`/`TxCtx` type-only import and the `await import("@/lib/db")` calls
 * inside its methods), so — unlike `finance`/`coupons` — a static top-level import of
 * `./actions` here would be safe; it is still done lazily inside each function body to match the
 * one established pattern for every other admin-mutations.ts file in this codebase.
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

export async function approveRequest(raw: unknown) {
  const { approveRequestAction } = await import("./actions");
  return withCtx(approveRequestAction, raw);
}

export async function rejectRequest(raw: unknown) {
  const { rejectRequestAction } = await import("./actions");
  return withCtx(rejectRequestAction, raw);
}

export async function cancelRequest(raw: unknown) {
  const { cancelRequestAction } = await import("./actions");
  return withCtx(cancelRequestAction, raw);
}

export async function retryApply(raw: unknown) {
  const { retryApplyAction } = await import("./actions");
  return withCtx(retryApplyAction, raw);
}
