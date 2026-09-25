/**
 * `catalog` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `CatalogService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { CatalogService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "catalog.<method> not implemented (P3)")`. */
export function createNotImplementedCatalogService(): CatalogService {
  return createNotImplemented<CatalogService>("catalog", "P3", {
    createProduct: "async",
    updateProduct: "async",
    createProductVersion: "async",
    upsertProductFaq: "async",
    deleteProductFaq: "async",
    reorderProductFaqs: "async",
    upsertProductTestimonial: "async",
    deleteProductTestimonial: "async",
    submitForApproval: "async",
    applyPublish: "async",
    onPublishRejected: "async",
    unpublishProduct: "async",
    requestArchive: "async",
    requestDelete: "async",
    applyArchive: "async",
    applyDelete: "async",
    listProductsAdmin: "async",
    getProductAdmin: "async",
    upsertCategory: "async",
    deleteCategory: "async",
    upsertTag: "async",
    getProductBySlug: "async",
    listCategories: "async",
    listFeaturedProducts: "async",
    toggleWishlist: "async",
    listMyWishlist: "async",
    refreshTagNames: "async",
  });
}
