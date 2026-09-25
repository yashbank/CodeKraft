/**
 * `content` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `ContentService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { ContentService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "content.<method> not implemented (P3)")`. */
export function createNotImplementedContentService(): ContentService {
  return createNotImplemented<ContentService>("content", "P3", {
    upsertLandingChapter: "async",
    setFeaturedProducts: "async",
    upsertService: "async",
    deleteService: "async",
    reorderServices: "async",
    upsertCaseStudy: "async",
    publishCaseStudy: "async",
    unpublishCaseStudy: "async",
    deleteCaseStudy: "async",
    upsertTestimonial: "async",
    deleteTestimonial: "async",
    reorderTestimonials: "async",
    upsertClientLogo: "async",
    deleteClientLogo: "async",
    reorderClientLogos: "async",
    upsertFaq: "async",
    deleteFaq: "async",
    reorderFaqs: "async",
    updateLegalPage: "async",
    publishLegalPage: "async",
    getLandingContent: "async",
    listServices: "async",
    listCaseStudies: "async",
    getCaseStudyBySlug: "async",
    listTestimonials: "async",
    listClientLogos: "async",
    listFaqs: "async",
    getLegalPage: "async",
  });
}
