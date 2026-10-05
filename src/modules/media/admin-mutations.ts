"use server";

/**
 * Thin server-action wrappers around the media module's `defineAction` mutations, so admin
 * client components (ProductEditor's Media tab, LandingEditor's hero image picker) can call
 * them directly by name without constructing a `RequestContext` themselves. Mirrors
 * `src/modules/catalog/admin-mutations.ts`.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";
import {
  attachProductMediaAction,
  completeUploadAction,
  createUploadIntentAction,
  detachProductMediaAction,
  reorderProductMediaAction,
} from "./actions";

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

export async function createMediaUploadIntent(raw: unknown) {
  return withCtx(createUploadIntentAction, raw);
}
export async function completeMediaUpload(raw: unknown) {
  return withCtx(completeUploadAction, raw);
}
export async function attachProductMedia(raw: unknown) {
  return withCtx(attachProductMediaAction, raw);
}
export async function reorderProductMedia(raw: unknown) {
  return withCtx(reorderProductMediaAction, raw);
}
export async function detachProductMedia(raw: unknown) {
  return withCtx(detachProductMediaAction, raw);
}
