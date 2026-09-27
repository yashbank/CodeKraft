"use server";

/**
 * Thin server-action wrappers around `modules/chat`'s `defineAction` mutations, so the admin
 * `ChatbotMonitor` client component can call them directly by name without constructing a
 * `RequestContext` itself. Mirrors `src/modules/users/admin-mutations.ts`.
 *
 * Unlike `modules/users`, `modules/chat/service.ts` does a STATIC top-level `@/lib/db` import, so
 * every wrapper here imports `./actions` LAZILY inside the function body — a static import would
 * pull server-only db code into the module graph client components (and jsdom unit tests) load.
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

export async function createPromptVersion(raw: unknown) {
  const { createPromptVersionAction } = await import("./actions");
  return withCtx(createPromptVersionAction, raw);
}

export async function activatePromptVersion(raw: unknown) {
  const { activatePromptVersionAction } = await import("./actions");
  return withCtx(activatePromptVersionAction, raw);
}

export async function rollbackPromptVersion(raw: unknown) {
  const { rollbackPromptVersionAction } = await import("./actions");
  return withCtx(rollbackPromptVersionAction, raw);
}

export async function reindexKnowledge(raw: unknown) {
  const { reindexKnowledgeAction } = await import("./actions");
  return withCtx(reindexKnowledgeAction, raw);
}

export async function getTranscript(raw: unknown) {
  const { getTranscriptQuery } = await import("./queries");
  return withCtx(getTranscriptQuery, raw);
}
