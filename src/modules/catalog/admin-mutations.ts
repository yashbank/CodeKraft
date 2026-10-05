"use server";

/**
 * Thin server-action wrappers around the catalog / ownership module `defineAction` mutations, so
 * the admin catalog client components (ProductsList, ProductEditor) can call them directly by
 * name without constructing a RequestContext themselves. Permission checks (`catalog.write` /
 * `catalog.submit` / `catalog.lifecycle.request`) still happen inside each underlying action —
 * this layer only supplies `ctx` and revalidates. Mirrors `src/modules/content/admin-mutations.ts`.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail } from "@/lib/actions/envelope";
import type { Context } from "@/lib/authz/context";
import {
  createProductAction,
  deleteCategoryAction,
  deleteProductFaqAction,
  deleteProductTestimonialAction,
  reorderProductFaqsAction,
  requestArchiveAction,
  requestDeleteAction,
  submitForApprovalAction,
  unpublishProductAction,
  updateProductAction,
  upsertCategoryAction,
  upsertProductFaqAction,
  upsertProductTestimonialAction,
  upsertTagAction,
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

export async function createProduct(raw: unknown) {
  return withCtx(createProductAction, raw);
}
export async function updateProduct(raw: unknown) {
  return withCtx(updateProductAction, raw);
}

export async function submitProductForApproval(raw: unknown) {
  return withCtx(submitForApprovalAction, raw);
}
export async function unpublishProduct(raw: unknown) {
  return withCtx(unpublishProductAction, raw);
}
export async function requestProductArchive(raw: unknown) {
  return withCtx(requestArchiveAction, raw);
}
export async function requestProductDelete(raw: unknown) {
  return withCtx(requestDeleteAction, raw);
}

export async function saveProductFaq(raw: unknown) {
  return withCtx(upsertProductFaqAction, raw);
}
export async function removeProductFaq(raw: unknown) {
  return withCtx(deleteProductFaqAction, raw);
}
export async function reorderProductFaqsList(raw: unknown) {
  return withCtx(reorderProductFaqsAction, raw);
}

export async function saveProductTestimonial(raw: unknown) {
  return withCtx(upsertProductTestimonialAction, raw);
}
export async function removeProductTestimonial(raw: unknown) {
  return withCtx(deleteProductTestimonialAction, raw);
}

export async function saveCategory(raw: unknown) {
  return withCtx(upsertCategoryAction, raw);
}
export async function removeCategory(raw: unknown) {
  return withCtx(deleteCategoryAction, raw);
}
export async function saveTag(raw: unknown) {
  return withCtx(upsertTagAction, raw);
}

/**
 * Ownership split proposals live in `src/modules/ownership` (a sibling module, not
 * `catalog`), but the product editor's "Ownership / split" tab calls it through this same
 * mutations file so the client component only imports from one place.
 */
export async function proposeOwnershipSplit(raw: unknown) {
  try {
    const [{ getAdminRequestContext }, { proposeOwnershipAction }] = await Promise.all([
      import("@/lib/authz/admin-request-context"),
      import("@/modules/ownership/actions"),
    ]);
    const ctx = await getAdminRequestContext();
    const result = await proposeOwnershipAction(raw, ctx);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    return fail(err);
  }
}

/**
 * Offerings live in `src/modules/offerings` (a sibling module, not `catalog`), same reason
 * and pattern as `proposeOwnershipSplit` above — the product editor's Offerings tab calls it
 * through this file so the client component only imports from one place.
 */
async function withOfferingsCtx<T>(
  pick: (actions: typeof import("@/modules/offerings/actions")) => (
    raw: unknown,
    ctx: Context,
  ) => Promise<ActionResult<T>>,
  raw: unknown,
): Promise<ActionResult<T>> {
  try {
    const [{ getAdminRequestContext }, actions] = await Promise.all([
      import("@/lib/authz/admin-request-context"),
      import("@/modules/offerings/actions"),
    ]);
    const ctx = await getAdminRequestContext();
    const result = await pick(actions)(raw, ctx);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function saveOffering(raw: unknown) {
  return withOfferingsCtx((a) => a.upsertOfferingAction, raw);
}
export async function removeOffering(raw: unknown) {
  return withOfferingsCtx((a) => a.deleteOfferingAction, raw);
}
export async function setOfferingPrices(raw: unknown) {
  return withOfferingsCtx((a) => a.setOfferingPricesAction, raw);
}
export async function setOfferingPaymentMethods(raw: unknown) {
  return withOfferingsCtx((a) => a.setOfferingPaymentMethodsAction, raw);
}
