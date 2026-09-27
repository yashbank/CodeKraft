"use server";

/**
 * Thin server-action wrappers around the customer-facing `modules/users` `defineAction`
 * mutations, so the account SettingsScreen client component can call them directly by name
 * without constructing a RequestContext itself. Permission checks (`account.self`) still happen
 * inside each underlying action -- this layer only supplies `ctx` and revalidates. Mirrors
 * `src/modules/users/admin-mutations.ts`, scoped to the signed-in customer instead of an admin.
 *
 * `./actions`, `./settings-actions` and `@/lib/authz/site-request-context` are imported lazily
 * inside each function body, never at module top level: `users/actions.ts` and
 * `users/settings-actions.ts` both pull in `usersService` / `settingsService`
 * (`@/lib/db` at module scope), which throws in a jsdom test environment (`src/lib/env.ts` guards
 * against `window`) -- a static import here would drag that into any client component
 * (`SettingsScreen`) that imports this file, the same reasoning as
 * `notifications/queries.ts`'s header comment.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail, ok } from "@/lib/actions/envelope";
import type { Context, RequestContext } from "@/lib/authz/context";

async function withSiteCtx<T>(
  loadAction: () => Promise<(raw: unknown, ctx: Context) => Promise<ActionResult<T>>>,
  raw: unknown,
  path?: string,
): Promise<ActionResult<T>> {
  try {
    const [{ getSiteRequestContext }, action] = await Promise.all([
      import("@/lib/authz/site-request-context"),
      loadAction(),
    ]);
    const ctx = await getSiteRequestContext();
    const result = await action(raw, ctx);
    if (result.ok && path) revalidatePath(path);
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function updateMyProfile(raw: unknown) {
  return withSiteCtx(
    async () => (await import("./actions")).updateProfileAction,
    raw,
    "/account/settings",
  );
}

export async function updateMyAccountSettings(raw: unknown) {
  // Named the same as `./actions`' `updateAccountSettingsAction`, but this one also refreshes the
  // `ck_currency` / `ck_theme` cookies that drive display-currency/theme elsewhere on the site.
  return withSiteCtx(
    async () => (await import("./settings-actions")).updateAccountSettingsAction,
    raw,
    "/account/settings",
  );
}

export async function requestMyEmailChange(raw: unknown) {
  return withSiteCtx(async () => (await import("./actions")).changeEmailRequestAction, raw);
}

export async function changeMyPassword(raw: unknown) {
  return withSiteCtx(async () => (await import("./actions")).changePasswordAction, raw);
}

export async function deleteMyAccount(raw: unknown) {
  return withSiteCtx(async () => (await import("./actions")).deleteAccountAction, raw);
}

/**
 * Revokes every session for the caller except the one making this call. There is no bulk
 * "revoke all others" method on `usersService` (only per-session `revokeSession`), so this
 * composes the existing `listSessions` / `revokeSession` service calls -- no new backend logic.
 */
export async function signOutMyOtherSessions(): Promise<ActionResult<{ revoked: number }>> {
  try {
    const [{ getSiteRequestContext }, { usersService }] = await Promise.all([
      import("@/lib/authz/site-request-context"),
      import("./service"),
    ]);
    const ctx: RequestContext = await getSiteRequestContext();
    const { sessions } = await usersService.listSessions(ctx);
    const others = sessions.filter((s) => !s.current);
    for (const s of others) {
      await usersService.revokeSession(ctx, { sessionId: s.id });
    }
    revalidatePath("/account/settings");
    return ok({ revoked: others.length });
  } catch (err) {
    return fail(err);
  }
}
