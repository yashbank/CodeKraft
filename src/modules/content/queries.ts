/**
 * `content` read-only queries — docs/06 §2.10 API-CONT-09 (public, `definePublicAction`,
 * published rows only, rich text rendered to sanitised HTML) plus admin reads (`content.read`).
 * Never mutate; cached per docs/06 §1.10 by the route layer (`content` / `case-studies` tags).
 */
import { z } from "zod";
import { defineAction, definePublicAction } from "@/lib/actions";
import { slugSchema } from "@/modules/_shared/zod";
import {
  faqScopeSchema,
  getCaseStudyBySlugSchema,
  getLegalPageSchema,
  legalPageKeySchema,
  listCaseStudiesSchema,
  listFaqsSchema,
  listTestimonialsSchema,
} from "./contracts";
import { contentService as service } from "./service";

const empty = z.strictObject({});

/* --- API-CONT-09 public ---------------------------------------------------------------------- */

export const getLandingContent = definePublicAction({
  name: "API-CONT-09 landing.get",
  input: empty,
  handler: (_input, ctx) => service.getLandingContent(ctx),
});

export const listServices = definePublicAction({
  name: "API-CONT-09 services.list",
  input: empty,
  handler: (_input, ctx) => service.listServices(ctx),
});

export const listCaseStudies = definePublicAction({
  name: "API-CONT-09 case_studies.list",
  input: listCaseStudiesSchema,
  handler: (input, ctx) => service.listCaseStudies(ctx, input),
});

export const getCaseStudyBySlug = definePublicAction({
  name: "API-CONT-09 case_study.get",
  input: getCaseStudyBySlugSchema,
  handler: (input, ctx) => service.getCaseStudyBySlug(ctx, input),
});

/** Live slug for a retired case-study slug (`{ slug: null }` when unknown) — the route 301s. */
export const resolveCaseStudySlug = definePublicAction({
  name: "API-CONT-09 case_study.resolve_slug",
  input: z.strictObject({ slug: slugSchema }),
  handler: (input, ctx) => service.resolveCaseStudySlug(ctx, input),
});

export const listTestimonials = definePublicAction({
  name: "API-CONT-09 testimonials.list",
  input: listTestimonialsSchema,
  handler: (input, ctx) => service.listTestimonials(ctx, input),
});

export const listClientLogos = definePublicAction({
  name: "API-CONT-09 client_logos.list",
  input: empty,
  handler: (_input, ctx) => service.listClientLogos(ctx),
});

export const listFaqs = definePublicAction({
  name: "API-CONT-09 faqs.list",
  input: listFaqsSchema,
  handler: (input, ctx) => service.listFaqs(ctx, input),
});

export const getLegalPage = definePublicAction({
  name: "API-CONT-09 legal_page.get",
  input: getLegalPageSchema,
  handler: (input, ctx) => service.getLegalPage(ctx, input),
});

/** Published featured products in landing order (ids + slugs; cards come from the catalog). */
export const listFeaturedProductIds = definePublicAction({
  name: "API-CONT-09 featured_products.list",
  input: empty,
  handler: (_input, ctx) => service.listFeaturedProductIds(ctx),
});

/* --- admin reads (`content.read`) ------------------------------------------------------------ */

export const listLandingChaptersAdmin = defineAction({
  name: "API-CONT-01 landing_chapters.list",
  input: empty,
  permission: "content.read",
  handler: (_input, ctx) => service.listLandingChaptersAdmin(ctx),
});

export const listFeaturedProductsAdmin = defineAction({
  name: "API-CONT-02 featured_products.list",
  input: empty,
  permission: "content.read",
  handler: (_input, ctx) => service.listFeaturedProductsAdmin(ctx),
});

export const listServicesAdmin = defineAction({
  name: "API-CONT-03 services.list",
  input: empty,
  permission: "content.read",
  handler: (_input, ctx) => service.listServicesAdmin(ctx),
});

export const listCaseStudiesAdmin = defineAction({
  name: "API-CONT-04 case_studies.list",
  input: empty,
  permission: "content.read",
  handler: (_input, ctx) => service.listCaseStudiesAdmin(ctx),
});

export const listTestimonialsAdmin = defineAction({
  name: "API-CONT-05 testimonials.list",
  input: empty,
  permission: "content.read",
  handler: (_input, ctx) => service.listTestimonialsAdmin(ctx),
});

export const listClientLogosAdmin = defineAction({
  name: "API-CONT-06 client_logos.list",
  input: empty,
  permission: "content.read",
  handler: (_input, ctx) => service.listClientLogosAdmin(ctx),
});

export const listFaqsAdmin = defineAction({
  name: "API-CONT-07 faqs.list",
  input: z.strictObject({ scope: faqScopeSchema.optional() }),
  permission: "content.read",
  handler: (input, ctx) => service.listFaqsAdmin(ctx, input),
});

export const listLegalPagesAdmin = defineAction({
  name: "API-CONT-08 legal_pages.list",
  input: empty,
  permission: "content.read",
  handler: (_input, ctx) => service.listLegalPagesAdmin(ctx),
});

export const listLegalPageVersions = defineAction({
  name: "API-CONT-08 legal_page_versions.list",
  input: z.strictObject({ key: legalPageKeySchema }),
  permission: "content.read",
  handler: (input, ctx) => service.listLegalPageVersions(ctx, input),
});
