"use server";

/**
 * Catalog Server Actions (API-CAT-01..09, 11..15, 20, 35, PHASE-03 P3.6).
 * All actions are wrapped in defineAction / definePublicAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  createProductSchema,
  createProductVersionSchema,
  deleteCategorySchema,
  deleteProductFaqSchema,
  deleteProductTestimonialSchema,
  lifecycleRequestSchema,
  reorderProductFaqsSchema,
  submitForApprovalSchema,
  toggleWishlistSchema,
  unpublishProductSchema,
  updateProductSchema,
  upsertCategorySchema,
  upsertProductFaqSchema,
  upsertProductTestimonialSchema,
  upsertTagSchema,
} from "./contracts";
import { catalogService } from "./service";

export const createProductAction = defineAction({
  name: "API-CAT-01 createProduct",
  input: createProductSchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.createProduct(ctx, input),
});

export const updateProductAction = defineAction({
  name: "API-CAT-02 updateProduct",
  input: updateProductSchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.updateProduct(ctx, input),
});

export const createProductVersionAction = defineAction({
  name: "API-CAT-07 createProductVersion",
  input: createProductVersionSchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.createProductVersion(ctx, input),
});

export const upsertProductFaqAction = defineAction({
  name: "API-CAT-08 upsertProductFaq",
  input: upsertProductFaqSchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.upsertProductFaq(ctx, input),
});

export const deleteProductFaqAction = defineAction({
  name: "API-CAT-08 deleteProductFaq",
  input: deleteProductFaqSchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.deleteProductFaq(ctx, input),
});

export const reorderProductFaqsAction = defineAction({
  name: "API-CAT-08 reorderProductFaqs",
  input: reorderProductFaqsSchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.reorderProductFaqs(ctx, input),
});

export const upsertProductTestimonialAction = defineAction({
  name: "API-CAT-09 upsertProductTestimonial",
  input: upsertProductTestimonialSchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.upsertProductTestimonial(ctx, input),
});

export const deleteProductTestimonialAction = defineAction({
  name: "API-CAT-09 deleteProductTestimonial",
  input: deleteProductTestimonialSchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.deleteProductTestimonial(ctx, input),
});

export const submitForApprovalAction = defineAction({
  name: "API-CAT-11 submitForApproval",
  input: submitForApprovalSchema,
  permission: "catalog.submit",
  handler: (input, ctx) => catalogService.submitForApproval(ctx, input),
});

export const unpublishProductAction = defineAction({
  name: "API-CAT-13 unpublishProduct",
  input: unpublishProductSchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.unpublishProduct(ctx, input),
});

export const requestArchiveAction = defineAction({
  name: "API-CAT-14 requestArchive",
  input: lifecycleRequestSchema,
  permission: "catalog.lifecycle.request",
  handler: (input, ctx) => catalogService.requestArchive(ctx, input),
});

export const requestDeleteAction = defineAction({
  name: "API-CAT-14 requestDelete",
  input: lifecycleRequestSchema,
  permission: "catalog.lifecycle.request",
  handler: (input, ctx) => catalogService.requestDelete(ctx, input),
});

export const upsertCategoryAction = defineAction({
  name: "API-CAT-20 upsertCategory",
  input: upsertCategorySchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.upsertCategory(ctx, input),
});

export const deleteCategoryAction = defineAction({
  name: "API-CAT-20 deleteCategory",
  input: deleteCategorySchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.deleteCategory(ctx, input),
});

export const upsertTagAction = defineAction({
  name: "API-CAT-20 upsertTag",
  input: upsertTagSchema,
  permission: "catalog.write",
  handler: (input, ctx) => catalogService.upsertTag(ctx, input),
});

export const toggleWishlistAction = defineAction({
  name: "API-CAT-35 toggleWishlist",
  input: toggleWishlistSchema,
  permission: "account.self",
  handler: (input, ctx) => catalogService.toggleWishlist(ctx, input),
});
