"use server";

/**
 * Content Server Actions (API-CONT-01..08, PHASE-03 P3.11).
 * All actions are wrapped in defineAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  contentIdSchema,
  publishLegalPageSchema,
  reorderSchema,
  setFeaturedProductsSchema,
  updateLegalPageSchema,
  upsertCaseStudySchema,
  upsertClientLogoSchema,
  upsertFaqSchema,
  upsertLandingChapterSchema,
  upsertServiceSchema,
  upsertTestimonialSchema,
} from "./contracts";
import { contentService } from "./service";

export const upsertLandingChapterAction = defineAction({
  name: "API-CONT-01 upsertLandingChapter",
  input: upsertLandingChapterSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.upsertLandingChapter(ctx, input),
});

export const setFeaturedProductsAction = defineAction({
  name: "API-CONT-02 setFeaturedProducts",
  input: setFeaturedProductsSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.setFeaturedProducts(ctx, input),
});

export const upsertServiceAction = defineAction({
  name: "API-CONT-03 upsertService",
  input: upsertServiceSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.upsertService(ctx, input),
});

export const deleteServiceAction = defineAction({
  name: "API-CONT-03 deleteService",
  input: contentIdSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.deleteService(ctx, input),
});

export const reorderServicesAction = defineAction({
  name: "API-CONT-03 reorderServices",
  input: reorderSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.reorderServices(ctx, input),
});

export const upsertCaseStudyAction = defineAction({
  name: "API-CONT-04 upsertCaseStudy",
  input: upsertCaseStudySchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.upsertCaseStudy(ctx, input),
});

export const publishCaseStudyAction = defineAction({
  name: "API-CONT-04 publishCaseStudy",
  input: contentIdSchema,
  permission: "content.publish",
  handler: (input, ctx) => contentService.publishCaseStudy(ctx, input),
});

export const unpublishCaseStudyAction = defineAction({
  name: "API-CONT-04 unpublishCaseStudy",
  input: contentIdSchema,
  permission: "content.publish",
  handler: (input, ctx) => contentService.unpublishCaseStudy(ctx, input),
});

export const deleteCaseStudyAction = defineAction({
  name: "API-CONT-04 deleteCaseStudy",
  input: contentIdSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.deleteCaseStudy(ctx, input),
});

export const upsertTestimonialAction = defineAction({
  name: "API-CONT-05 upsertTestimonial",
  input: upsertTestimonialSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.upsertTestimonial(ctx, input),
});

export const deleteTestimonialAction = defineAction({
  name: "API-CONT-05 deleteTestimonial",
  input: contentIdSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.deleteTestimonial(ctx, input),
});

export const reorderTestimonialsAction = defineAction({
  name: "API-CONT-05 reorderTestimonials",
  input: reorderSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.reorderTestimonials(ctx, input),
});

export const upsertClientLogoAction = defineAction({
  name: "API-CONT-06 upsertClientLogo",
  input: upsertClientLogoSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.upsertClientLogo(ctx, input),
});

export const deleteClientLogoAction = defineAction({
  name: "API-CONT-06 deleteClientLogo",
  input: contentIdSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.deleteClientLogo(ctx, input),
});

export const reorderClientLogosAction = defineAction({
  name: "API-CONT-06 reorderClientLogos",
  input: reorderSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.reorderClientLogos(ctx, input),
});

export const upsertFaqAction = defineAction({
  name: "API-CONT-07 upsertFaq",
  input: upsertFaqSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.upsertFaq(ctx, input),
});

export const deleteFaqAction = defineAction({
  name: "API-CONT-07 deleteFaq",
  input: contentIdSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.deleteFaq(ctx, input),
});

export const reorderFaqsAction = defineAction({
  name: "API-CONT-07 reorderFaqs",
  input: reorderSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.reorderFaqs(ctx, input),
});

export const updateLegalPageAction = defineAction({
  name: "API-CONT-08 updateLegalPage",
  input: updateLegalPageSchema,
  permission: "content.write",
  handler: (input, ctx) => contentService.updateLegalPage(ctx, input),
});

export const publishLegalPageAction = defineAction({
  name: "API-CONT-08 publishLegalPage",
  input: publishLegalPageSchema,
  permission: "content.publish",
  handler: (input, ctx) => contentService.publishLegalPage(ctx, input),
});
