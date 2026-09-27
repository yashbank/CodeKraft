"use server";

/**
 * Thin server-action wrappers around the finance `defineAction` mutations, so the admin finance
 * client components (ExpensesScreen, AdjustmentsScreen, PartnersPayouts, ReportsScreen) can call
 * them directly by name without constructing a RequestContext themselves. Permission checks
 * (`finance.payout.record` / `finance.expense.write` / `finance.adjustment.propose` /
 * `finance.statements.export`) still happen inside each underlying action -- this layer only
 * supplies `ctx` and revalidates.
 *
 * Several `finance` service files (`balances.ts`, `expenses.ts`, `payouts.ts`, `reports.ts`,
 * `statements.ts`, `adjustments.ts`) import `@/lib/db` at the top level (value import, not
 * type-only), which pulls in `@/lib/env` and throws when evaluated in a browser/jsdom context.
 * `finance/service.ts` re-exports all of them, so every wrapper below imports `./actions` lazily
 * inside the function body (never a static top-level import) -- same pattern as
 * `payments/admin-mutations.ts` -- keeping this "use server" file's client-side RPC stub free of
 * server-only code, which matters for Vitest/jsdom unit tests of the client components that call
 * these.
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
    // Lazy import: keeps server-only auth/db code out of the module graph that client
    // components pull in for the "use server" RPC stub (matters for jsdom unit tests, which
    // don't get Next.js's server-action bundling split).
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    const result = await action(raw, ctx);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function recordPayout(raw: unknown) {
  const { recordPayoutAction } = await import("./actions");
  return withCtx(recordPayoutAction, raw);
}

export async function recordExpense(raw: unknown) {
  const { recordExpenseAction } = await import("./actions");
  return withCtx(recordExpenseAction, raw);
}

export async function proposeAdjustment(raw: unknown) {
  const { proposeAdjustmentAction } = await import("./actions");
  return withCtx(proposeAdjustmentAction, raw);
}

export async function exportStatement(raw: unknown) {
  const { exportStatementAction } = await import("./actions");
  return withCtx(exportStatementAction, raw);
}
