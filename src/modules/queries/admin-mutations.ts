"use server";

/**
 * Thin server-action wrappers around the queries `defineAction` mutations, so the `QueriesInbox`
 * client component can call them directly by name. Permission checks (`queries.reply` /
 * `queries.close`) still happen inside each underlying action; this layer only supplies `ctx`
 * and revalidates.
 *
 * `queries/service.ts` does a STATIC top-level value import of `@/lib/db` (`import { type TxCtx,
 * getDb } from "@/lib/db"`), which throws when evaluated in a browser/jsdom context. Every
 * mutation wrapper below therefore imports `./actions` lazily inside the function body — same
 * pattern as `finance/admin-mutations.ts` / `leads/admin-mutations.ts`.
 *
 * `fetchQueryThread` is a read, not a mutation, but the `QueriesInbox` list/thread layout needs
 * to load a different thread's messages on demand as the admin clicks between rows (the
 * component only ever received one fixed `thread` prop before P6); it lives here, alongside the
 * mutations it revalidates the page for, rather than in `queries.ts` (which only holds `page.tsx`
 * reads) so this file's already-established lazy-import convention covers it too.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";
import { buildAdminNameMap, mapQueryThread } from "@/lib/admin/queries-view";
import type { QueryThread } from "@/components/admin/types";

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

export async function createQueryAdmin(raw: unknown) {
  const { createQueryAdminAction } = await import("./actions");
  return withCtx(createQueryAdminAction, raw);
}

export async function replyToQuery(raw: unknown) {
  const { replyToQueryAction } = await import("./actions");
  return withCtx(replyToQueryAction, raw);
}

export async function assignQuery(raw: unknown) {
  const { assignQueryAction } = await import("./actions");
  return withCtx(assignQueryAction, raw);
}

export async function closeQuery(raw: unknown) {
  const { closeQueryAction } = await import("./actions");
  return withCtx(closeQueryAction, raw);
}

export async function reopenQuery(raw: unknown) {
  const { reopenQueryAction } = await import("./actions");
  return withCtx(reopenQueryAction, raw);
}

export async function fetchQueryThread(queryId: string): Promise<ActionResult<QueryThread>> {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const { getQueryAdminQuery, listAssignableAdminsQuery } = await import("./queries");
    const ctx = await getAdminRequestContext();
    const [threadResult, adminsResult] = await Promise.all([
      getQueryAdminQuery({ queryId }, ctx),
      listAssignableAdminsQuery({}, ctx),
    ]);
    if (!threadResult.ok) return threadResult;
    const admins = adminsResult.ok ? adminsResult.data.items : [];
    return { ok: true, data: mapQueryThread(threadResult.data, buildAdminNameMap(admins)) };
  } catch (err) {
    return fail(err);
  }
}
