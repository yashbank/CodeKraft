"use server";

/**
 * Thin server-action wrappers around the `chat` `defineAction` mutations, so the customer
 * `ChatScreen` client component can call them directly by name. Permission checks (`chat.use`)
 * still happen inside each underlying action; this layer only supplies `ctx`. Lazy
 * `await import("./actions")` — `chat/service.ts` does a static top-level import of `@/lib/db`,
 * which throws when evaluated in a browser/jsdom context (same pattern as
 * `queries/admin-mutations.ts`). Sending a message itself streams over `POST /api/chat` (SSE),
 * not a Server Action — actions can't stream — see `src/app/api/chat/route.ts`.
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

export async function startConversation(raw: unknown) {
  const { startConversationAction } = await import("./actions");
  return withCtx(startConversationAction, raw);
}

export async function menuIntent(raw: unknown) {
  const { menuIntentAction } = await import("./actions");
  return withCtx(menuIntentAction, raw);
}

export async function escalateConversation(raw: unknown) {
  const { escalateConversationAction } = await import("./actions");
  return withCtx(escalateConversationAction, raw);
}

export async function endConversation(raw: unknown) {
  const { endConversationAction } = await import("./actions");
  return withCtx(endConversationAction, raw);
}

export async function confirmLeadCapture(raw: unknown) {
  const { confirmLeadCaptureAction } = await import("./actions");
  return withCtx(confirmLeadCaptureAction, raw);
}
