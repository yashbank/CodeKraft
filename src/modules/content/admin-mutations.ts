"use server";

/**
 * Thin server-action wrappers around the content module's defineAction mutations, so the admin
 * content editors (client components) can call them directly by name without constructing a
 * RequestContext themselves. Permission checks (`content.write` / `content.publish`) still
 * happen inside each underlying action — this layer only supplies `ctx` and revalidates.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";
import {
  deleteCaseStudyAction,
  deleteClientLogoAction,
  deleteFaqAction,
  deleteServiceAction,
  deleteTestimonialAction,
  publishCaseStudyAction,
  publishLegalPageAction,
  reorderClientLogosAction,
  reorderFaqsAction,
  reorderServicesAction,
  reorderTestimonialsAction,
  setFeaturedProductsAction,
  unpublishCaseStudyAction,
  updateLegalPageAction,
  upsertCaseStudyAction,
  upsertClientLogoAction,
  upsertFaqAction,
  upsertLandingChapterAction,
  upsertServiceAction,
  upsertTestimonialAction,
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

export async function saveLandingChapter(raw: unknown) {
  return withCtx(upsertLandingChapterAction, raw);
}
export async function saveFeaturedProducts(raw: unknown) {
  return withCtx(setFeaturedProductsAction, raw);
}

export async function saveService(raw: unknown) {
  return withCtx(upsertServiceAction, raw);
}
export async function removeService(raw: unknown) {
  return withCtx(deleteServiceAction, raw);
}
export async function reorderServicesList(raw: unknown) {
  return withCtx(reorderServicesAction, raw);
}

export async function saveCaseStudy(raw: unknown) {
  return withCtx(upsertCaseStudyAction, raw);
}
export async function publishCaseStudyById(raw: unknown) {
  return withCtx(publishCaseStudyAction, raw);
}
export async function unpublishCaseStudyById(raw: unknown) {
  return withCtx(unpublishCaseStudyAction, raw);
}
export async function removeCaseStudy(raw: unknown) {
  return withCtx(deleteCaseStudyAction, raw);
}

export async function saveTestimonial(raw: unknown) {
  return withCtx(upsertTestimonialAction, raw);
}
export async function removeTestimonial(raw: unknown) {
  return withCtx(deleteTestimonialAction, raw);
}
export async function reorderTestimonialsList(raw: unknown) {
  return withCtx(reorderTestimonialsAction, raw);
}

export async function saveClientLogo(raw: unknown) {
  return withCtx(upsertClientLogoAction, raw);
}
export async function removeClientLogo(raw: unknown) {
  return withCtx(deleteClientLogoAction, raw);
}
export async function reorderClientLogosList(raw: unknown) {
  return withCtx(reorderClientLogosAction, raw);
}

export async function saveFaq(raw: unknown) {
  return withCtx(upsertFaqAction, raw);
}
export async function removeFaq(raw: unknown) {
  return withCtx(deleteFaqAction, raw);
}
export async function reorderFaqsList(raw: unknown) {
  return withCtx(reorderFaqsAction, raw);
}

export async function saveLegalPage(raw: unknown) {
  return withCtx(updateLegalPageAction, raw);
}
export async function publishLegalPageByKey(raw: unknown) {
  return withCtx(publishLegalPageAction, raw);
}
