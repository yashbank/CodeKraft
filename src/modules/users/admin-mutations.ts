"use server";

/**
 * Thin server-action wrappers around the `modules/users` customer `defineAction` mutations, so
 * the admin CustomersList / CustomerDetail client components can call them directly by name
 * without constructing a RequestContext themselves. Permission checks (`customers.notes.write` /
 * `customers.suspend` / `customers.reset_link`) still happen inside each underlying action --
 * this layer only supplies `ctx` and revalidates. Mirrors `src/modules/catalog/admin-mutations.ts`.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";
import {
  reinstateCustomerAction,
  sendMagicLinkAction,
  sendResetLinkAction,
  suspendCustomerAction,
  updateCustomerNotesAction,
} from "./actions";

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

export async function updateCustomerNotes(raw: unknown) {
  return withCtx(updateCustomerNotesAction, raw);
}

export async function suspendCustomer(raw: unknown) {
  return withCtx(suspendCustomerAction, raw);
}

export async function reinstateCustomer(raw: unknown) {
  return withCtx(reinstateCustomerAction, raw);
}

export async function sendResetLink(raw: unknown) {
  return withCtx(sendResetLinkAction, raw);
}

export async function sendMagicLink(raw: unknown) {
  return withCtx(sendMagicLinkAction, raw);
}
