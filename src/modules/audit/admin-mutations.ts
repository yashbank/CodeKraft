"use server";

/**
 * Thin server-action wrapper around `modules/audit`'s `exportAuditLogsAction`, so the admin
 * `AuditLog` client component can call it directly by name without constructing a
 * `RequestContext` itself. Mirrors `src/modules/users/admin-mutations.ts`.
 */
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";
import { exportAuditLogsAction } from "./actions";

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

export async function exportAuditLogs(raw: unknown) {
  return withCtx(exportAuditLogsAction, raw);
}
