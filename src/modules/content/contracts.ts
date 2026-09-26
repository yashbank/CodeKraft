/**
 * Content contracts — docs/06 §2.10 API-CONT-01..09 (`content.write`; publish flags need
 * `content.publish`), docs/06 §1.10 (`content`, `case-studies`, `case-study:<slug>` tags).
 */
import { z } from "zod";
import type { Context, RequestContext } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import {
  type ListResult,
  listParams,
  richTextSchema,
  slugSchema,
  uuidSchema,
} from "@/modules/_shared/zod";
import { httpUrlSchema, positionSchema, text } from "../catalog/contracts";
import { embedUrlSchema } from "../media/contracts";
import {
  FAQ_SCOPES,
  FEATURED_PRODUCTS_MAX,
  LANDING_CHAPTER_KEYS,
  LEGAL_PAGE_KEYS,
  TESTIMONIAL_CONTEXTS,
  type CaseStudy,
  type CaseStudyCard,
  type CaseStudyDetail,
  type ClientLogo,
  type ClientLogoView,
  type Faq,
  type FaqView,
  type LandingChapter,
  type LandingContent,
  type LegalPage,
  type LegalPageVersion,
  type LegalPageView,
  type Service,
  type ServiceView,
  type Testimonial,
  type TestimonialView,
} from "./types";

export const landingChapterKeySchema = z.enum(LANDING_CHAPTER_KEYS);
export const testimonialContextSchema = z.enum(TESTIMONIAL_CONTEXTS);
export const faqScopeSchema = z.enum(FAQ_SCOPES);
export const legalPageKeySchema = z.enum(LEGAL_PAGE_KEYS);

/** Relative path or http(s) URL (CTA targets). */
export const hrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .regex(/^(\/(?!\/)|https?:\/\/)/, "href must be a relative path or an http(s) URL");

export const ctaLinkSchema = z.strictObject({ label: text(60), href: hrefSchema });

/** API-CONT-01 `upsertLandingChapter` (D-801, D-802). */
export const upsertLandingChapterSchema = z.strictObject({
  key: landingChapterKeySchema,
  eyebrow: text(60).optional(),
  title: text(120),
  subtitle: text(200).optional(),
  bodyJson: richTextSchema,
  media: z.strictObject({
    posterMediaId: uuidSchema.optional(),
    videoEmbedUrl: embedUrlSchema.optional(),
    sceneVariant: text(40).optional(),
  }),
  cta: z.strictObject({ primary: ctaLinkSchema, secondary: ctaLinkSchema.optional() }),
  position: positionSchema,
  published: z.boolean(),
});
export type UpsertLandingChapterInput = z.infer<typeof upsertLandingChapterSchema>;

/** API-CONT-02 `setFeaturedProducts` (≤ 8, published only — checked by the service). */
export const setFeaturedProductsSchema = z.strictObject({
  productIds: z
    .array(uuidSchema)
    .max(FEATURED_PRODUCTS_MAX)
    .refine((ids) => new Set(ids).size === ids.length, { message: "duplicate product" }),
});
export type SetFeaturedProductsInput = z.infer<typeof setFeaturedProductsSchema>;

/** API-CONT-03 `upsertService` (D-302, D-806). */
export const upsertServiceSchema = z.strictObject({
  id: uuidSchema.optional(),
  slug: slugSchema,
  title: text(120),
  summary: text(300),
  deliverables: z.array(text(160)).max(20),
  bodyJson: richTextSchema,
  /** lucide icon name */
  icon: text(64),
  position: positionSchema,
  published: z.boolean(),
});
export type UpsertServiceInput = z.infer<typeof upsertServiceSchema>;

export const galleryItemSchema = z.strictObject({
  mediaId: uuidSchema,
  alt: text(125),
  caption: text(200).optional(),
});

/** API-CONT-04 `upsertCaseStudy` (D-803). */
export const upsertCaseStudySchema = z.strictObject({
  id: uuidSchema.optional(),
  slug: slugSchema,
  title: text(160),
  clientName: text(120),
  industry: text(80),
  problemJson: richTextSchema,
  solutionJson: richTextSchema,
  resultsJson: richTextSchema,
  resultHighlight: text(60).optional(),
  techStack: z.array(text(60)).max(30),
  coverMediaId: uuidSchema.optional(),
  gallery: z.array(galleryItemSchema).max(24).optional(),
  seoTitle: text(70).optional(),
  seoDescription: text(160).optional(),
});
export type UpsertCaseStudyInput = z.infer<typeof upsertCaseStudySchema>;

/** API-CONT-05 `upsertTestimonial` (site-wide; `productId` required for `context: 'product'`). */
export const upsertTestimonialSchema = z
  .strictObject({
    id: uuidSchema.optional(),
    quote: text(1000),
    authorName: text(120),
    authorTitle: text(120).optional(),
    company: text(120).optional(),
    avatarMediaId: uuidSchema.optional(),
    context: testimonialContextSchema,
    productId: uuidSchema.optional(),
    position: positionSchema,
    published: z.boolean(),
  })
  .refine((t) => t.context !== "product" || t.productId !== undefined, {
    message: "product testimonials need a productId",
    path: ["productId"],
  });
export type UpsertTestimonialInput = z.infer<typeof upsertTestimonialSchema>;

/** API-CONT-06 `upsertClientLogo`. */
export const upsertClientLogoSchema = z.strictObject({
  id: uuidSchema.optional(),
  name: text(120),
  mediaId: uuidSchema,
  url: httpUrlSchema.optional(),
  position: positionSchema,
  published: z.boolean(),
});
export type UpsertClientLogoInput = z.infer<typeof upsertClientLogoSchema>;

/** API-CONT-07 `upsertFaq` (`productId` required for `scope: 'product'`). */
export const upsertFaqSchema = z
  .strictObject({
    id: uuidSchema.optional(),
    question: text(300),
    answerJson: richTextSchema,
    scope: faqScopeSchema,
    productId: uuidSchema.optional(),
    position: positionSchema,
    published: z.boolean(),
  })
  .refine((f) => f.scope !== "product" || f.productId !== undefined, {
    message: "product FAQs need a productId",
    path: ["productId"],
  });
export type UpsertFaqInput = z.infer<typeof upsertFaqSchema>;

/** API-CONT-08 `updateLegalPage` / `publishLegalPage` (D-807). */
export const updateLegalPageSchema = z.strictObject({
  key: legalPageKeySchema,
  title: text(120),
  bodyJson: richTextSchema,
});
export type UpdateLegalPageInput = z.infer<typeof updateLegalPageSchema>;
export const publishLegalPageSchema = z.strictObject({ key: legalPageKeySchema });

/** Shared `{ id }` / `{ ids[] }` inputs for delete / reorder (API-CONT-03..07). */
export const contentIdSchema = z.strictObject({ id: uuidSchema });
export const reorderSchema = z.strictObject({ ids: z.array(uuidSchema).min(1).max(500) });

/** API-CONT-09 public reads. */
export const listCaseStudiesSchema = listParams(
  ["publishedAt", "title"],
  z.strictObject({
    industry: text(80).optional(),
    techStack: z.array(text(60)).max(10).optional(),
  }),
);
export const getCaseStudyBySlugSchema = z.strictObject({ slug: slugSchema });
export const listTestimonialsSchema = z.strictObject({
  context: testimonialContextSchema,
  productSlug: slugSchema.optional(),
});
export const listFaqsSchema = z.strictObject({
  scope: faqScopeSchema,
  productSlug: slugSchema.optional(),
});
export const getLegalPageSchema = z.strictObject({ key: legalPageKeySchema });

export const CONTENT_CACHE_TAGS = {
  upsertLandingChapter: ["content"],
  setFeaturedProducts: ["content", "catalog"],
  upsertService: ["content"],
  deleteService: ["content"],
  reorderServices: ["content"],
  upsertCaseStudy: ["case-studies", "sitemap"],
  publishCaseStudy: ["case-studies", "sitemap"],
  unpublishCaseStudy: ["case-studies", "sitemap"],
  deleteCaseStudy: ["case-studies", "sitemap"],
  upsertTestimonial: ["content"],
  deleteTestimonial: ["content"],
  reorderTestimonials: ["content"],
  upsertClientLogo: ["content"],
  deleteClientLogo: ["content"],
  reorderClientLogos: ["content"],
  upsertFaq: ["content"],
  deleteFaq: ["content"],
  reorderFaqs: ["content"],
  updateLegalPage: ["content"],
  publishLegalPage: ["content"],
} as const satisfies Record<string, readonly string[]>;

export type Id = z.infer<typeof contentIdSchema>;
export type Reorder = z.infer<typeof reorderSchema>;

export interface ContentService {
  /** API-CONT-01 */
  upsertLandingChapter(
    ctx: RequestContext,
    input: UpsertLandingChapterInput,
    tx?: DbOrTx,
  ): Promise<{ chapter: LandingChapter }>;
  /** API-CONT-02 */
  setFeaturedProducts(
    ctx: RequestContext,
    input: SetFeaturedProductsInput,
    tx?: DbOrTx,
  ): Promise<{ featured: { productId: string; position: number }[] }>;
  /** API-CONT-03 */
  upsertService(
    ctx: RequestContext,
    input: UpsertServiceInput,
    tx?: DbOrTx,
  ): Promise<{ service: Service }>;
  /** API-CONT-03 */
  deleteService(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<void>;
  /** API-CONT-03 */
  reorderServices(
    ctx: RequestContext,
    input: Reorder,
    tx?: DbOrTx,
  ): Promise<{ services: Service[] }>;
  /** API-CONT-04 */
  upsertCaseStudy(
    ctx: RequestContext,
    input: UpsertCaseStudyInput,
    tx?: DbOrTx,
  ): Promise<{ caseStudy: CaseStudy }>;
  /** API-CONT-04 (`content.publish`). */
  publishCaseStudy(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<{ caseStudy: CaseStudy }>;
  /** API-CONT-04 (`content.publish`). */
  unpublishCaseStudy(
    ctx: RequestContext,
    input: Id,
    tx?: DbOrTx,
  ): Promise<{ caseStudy: CaseStudy }>;
  /** API-CONT-04 */
  deleteCaseStudy(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<void>;
  /** API-CONT-05 */
  upsertTestimonial(
    ctx: RequestContext,
    input: UpsertTestimonialInput,
    tx?: DbOrTx,
  ): Promise<{ testimonial: Testimonial }>;
  /** API-CONT-05 */
  deleteTestimonial(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<void>;
  /** API-CONT-05 */
  reorderTestimonials(
    ctx: RequestContext,
    input: Reorder,
    tx?: DbOrTx,
  ): Promise<{ testimonials: Testimonial[] }>;
  /** API-CONT-06 */
  upsertClientLogo(
    ctx: RequestContext,
    input: UpsertClientLogoInput,
    tx?: DbOrTx,
  ): Promise<{ logo: ClientLogo }>;
  /** API-CONT-06 */
  deleteClientLogo(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<void>;
  /** API-CONT-06 */
  reorderClientLogos(
    ctx: RequestContext,
    input: Reorder,
    tx?: DbOrTx,
  ): Promise<{ logos: ClientLogo[] }>;
  /** API-CONT-07 */
  upsertFaq(ctx: RequestContext, input: UpsertFaqInput, tx?: DbOrTx): Promise<{ faq: Faq }>;
  /** API-CONT-07 */
  deleteFaq(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<void>;
  /** API-CONT-07 */
  reorderFaqs(ctx: RequestContext, input: Reorder, tx?: DbOrTx): Promise<{ faqs: Faq[] }>;
  /** API-CONT-08 — saves the draft text (no version bump). */
  updateLegalPage(
    ctx: RequestContext,
    input: UpdateLegalPageInput,
    tx?: DbOrTx,
  ): Promise<{ page: LegalPage }>;
  /** API-CONT-08 (`content.publish`) — `version += 1`, snapshot into `legal_page_versions`. */
  publishLegalPage(
    ctx: RequestContext,
    input: z.infer<typeof publishLegalPageSchema>,
    tx?: DbOrTx,
  ): Promise<{ page: LegalPage; version: LegalPageVersion }>;
  /** API-CONT-09 */
  getLandingContent(ctx: Context, tx?: DbOrTx): Promise<LandingContent>;
  /** API-CONT-09 */
  listServices(ctx: Context, tx?: DbOrTx): Promise<ServiceView[]>;
  /** API-CONT-09 */
  listCaseStudies(
    ctx: Context,
    input: z.infer<typeof listCaseStudiesSchema>,
    tx?: DbOrTx,
  ): Promise<ListResult<CaseStudyCard>>;
  /** API-CONT-09 */
  getCaseStudyBySlug(
    ctx: Context,
    input: z.infer<typeof getCaseStudyBySlugSchema>,
    tx?: DbOrTx,
  ): Promise<CaseStudyDetail>;
  /** API-CONT-09 */
  listTestimonials(
    ctx: Context,
    input: z.infer<typeof listTestimonialsSchema>,
    tx?: DbOrTx,
  ): Promise<TestimonialView[]>;
  /** API-CONT-09 */
  listClientLogos(ctx: Context, tx?: DbOrTx): Promise<ClientLogoView[]>;
  /** API-CONT-09 */
  listFaqs(ctx: Context, input: z.infer<typeof listFaqsSchema>, tx?: DbOrTx): Promise<FaqView[]>;
  /** API-CONT-09 */
  getLegalPage(
    ctx: Context,
    input: z.infer<typeof getLegalPageSchema>,
    tx?: DbOrTx,
  ): Promise<LegalPageView>;
}
