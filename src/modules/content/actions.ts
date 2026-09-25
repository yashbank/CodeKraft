/**
 * `content` Server Actions — docs/06 §2.10 API-CONT-01..08. Every export is a `defineAction`
 * (SA-07): Zod parse → permission → service (audit inside the transaction) → cache-tag
 * revalidation per docs/06 §1.10 after commit. Reads live in `queries.ts`.
 */
import { defineAction } from "@/lib/actions";
import {
  CONTENT_CACHE_TAGS,
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
import { TAG_SITEMAP, caseStudyTag, productTag, revalidateTags } from "./revalidate";
import { contentService as service } from "./service";

const tags = (key: keyof typeof CONTENT_CACHE_TAGS, ...extra: (string | null | undefined)[]) =>
  revalidateTags([...CONTENT_CACHE_TAGS[key], ...extra]);

/* --- API-CONT-01 / 02 ---------------------------------------------------------------------- */

export const upsertLandingChapter = defineAction({
  name: "API-CONT-01 landing_chapter.upsert",
  input: upsertLandingChapterSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const result = await service.upsertLandingChapter(ctx, input);
    tags("upsertLandingChapter");
    return result;
  },
});

export const setFeaturedProducts = defineAction({
  name: "API-CONT-02 featured_products.set",
  input: setFeaturedProductsSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const result = await service.setFeaturedProducts(ctx, input);
    tags("setFeaturedProducts");
    return result;
  },
});

/* --- API-CONT-03 services ------------------------------------------------------------------ */

export const upsertService = defineAction({
  name: "API-CONT-03 service.upsert",
  input: upsertServiceSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const result = await service.upsertService(ctx, input);
    tags("upsertService");
    return result;
  },
});

export const deleteService = defineAction({
  name: "API-CONT-03 service.delete",
  input: contentIdSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    await service.deleteService(ctx, input);
    tags("deleteService");
    return { id: input.id };
  },
});

export const reorderServices = defineAction({
  name: "API-CONT-03 service.reorder",
  input: reorderSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const result = await service.reorderServices(ctx, input);
    tags("reorderServices");
    return result;
  },
});

/* --- API-CONT-04 case studies -------------------------------------------------------------- */

export const upsertCaseStudy = defineAction({
  name: "API-CONT-04 case_study.upsert",
  input: upsertCaseStudySchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const { caseStudy, previousSlug } = await service.upsertCaseStudy(ctx, input);
    tags("upsertCaseStudy", caseStudyTag(caseStudy.slug), previousSlug === null ? null : caseStudyTag(previousSlug));
    return { caseStudy };
  },
});

export const publishCaseStudy = defineAction({
  name: "API-CONT-04 case_study.publish",
  input: contentIdSchema,
  permission: "content.publish",
  handler: async (input, ctx) => {
    const { caseStudy } = await service.publishCaseStudy(ctx, input);
    tags("publishCaseStudy", caseStudyTag(caseStudy.slug));
    return { caseStudy };
  },
});

export const unpublishCaseStudy = defineAction({
  name: "API-CONT-04 case_study.unpublish",
  input: contentIdSchema,
  permission: "content.publish",
  handler: async (input, ctx) => {
    const { caseStudy } = await service.unpublishCaseStudy(ctx, input);
    tags("unpublishCaseStudy", caseStudyTag(caseStudy.slug));
    return { caseStudy };
  },
});

export const deleteCaseStudy = defineAction({
  name: "API-CONT-04 case_study.delete",
  input: contentIdSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const { slug } = await service.deleteCaseStudyReturningSlug(ctx, input);
    tags("deleteCaseStudy", caseStudyTag(slug));
    return { id: input.id };
  },
});

/* --- API-CONT-05 testimonials -------------------------------------------------------------- */

export const upsertTestimonial = defineAction({
  name: "API-CONT-05 testimonial.upsert",
  input: upsertTestimonialSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const { testimonial, productSlug } = await service.upsertTestimonial(ctx, input);
    tags("upsertTestimonial", productSlug === null ? null : productTag(productSlug));
    return { testimonial };
  },
});

export const deleteTestimonial = defineAction({
  name: "API-CONT-05 testimonial.delete",
  input: contentIdSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const { productSlug } = await service.deleteTestimonialReturningSlug(ctx, input);
    tags("deleteTestimonial", productSlug === null ? null : productTag(productSlug));
    return { id: input.id };
  },
});

export const reorderTestimonials = defineAction({
  name: "API-CONT-05 testimonial.reorder",
  input: reorderSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const result = await service.reorderTestimonials(ctx, input);
    tags("reorderTestimonials");
    return result;
  },
});

/* --- API-CONT-06 client logos -------------------------------------------------------------- */

export const upsertClientLogo = defineAction({
  name: "API-CONT-06 client_logo.upsert",
  input: upsertClientLogoSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const result = await service.upsertClientLogo(ctx, input);
    tags("upsertClientLogo");
    return result;
  },
});

export const deleteClientLogo = defineAction({
  name: "API-CONT-06 client_logo.delete",
  input: contentIdSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    await service.deleteClientLogo(ctx, input);
    tags("deleteClientLogo");
    return { id: input.id };
  },
});

export const reorderClientLogos = defineAction({
  name: "API-CONT-06 client_logo.reorder",
  input: reorderSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const result = await service.reorderClientLogos(ctx, input);
    tags("reorderClientLogos");
    return result;
  },
});

/* --- API-CONT-07 FAQs ---------------------------------------------------------------------- */

export const upsertFaq = defineAction({
  name: "API-CONT-07 faq.upsert",
  input: upsertFaqSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const { faq, productSlug } = await service.upsertFaq(ctx, input);
    tags("upsertFaq", productSlug === null ? null : productTag(productSlug));
    return { faq };
  },
});

export const deleteFaq = defineAction({
  name: "API-CONT-07 faq.delete",
  input: contentIdSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const { productSlug } = await service.deleteFaqReturningSlug(ctx, input);
    tags("deleteFaq", productSlug === null ? null : productTag(productSlug));
    return { id: input.id };
  },
});

export const reorderFaqs = defineAction({
  name: "API-CONT-07 faq.reorder",
  input: reorderSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const result = await service.reorderFaqs(ctx, input);
    tags("reorderFaqs");
    return result;
  },
});

/* --- API-CONT-08 legal pages --------------------------------------------------------------- */

export const updateLegalPage = defineAction({
  name: "API-CONT-08 legal_page.update",
  input: updateLegalPageSchema,
  permission: "content.write",
  handler: async (input, ctx) => {
    const result = await service.updateLegalPage(ctx, input);
    tags("updateLegalPage");
    return result;
  },
});

export const publishLegalPage = defineAction({
  name: "API-CONT-08 legal_page.publish",
  input: publishLegalPageSchema,
  permission: "content.publish",
  handler: async (input, ctx) => {
    const result = await service.publishLegalPage(ctx, input);
    tags("publishLegalPage", TAG_SITEMAP);
    return result;
  },
});
