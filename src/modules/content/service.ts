/**
 * `content` service (PHASE-03 P3.11) — the frozen `ContentService` contract (docs/06 §2.10
 * API-CONT-01..09) plus admin reads. Mutations audit inside their transaction (docs/06 §1.6);
 * cache tags are revalidated by `actions.ts` after commit.
 *
 * `createContentService(deps)` for tests (fake audit / clock / media resolver);
 * `contentService` is the production singleton.
 */
import type { Context, RequestContext } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import type { ListResult } from "@/modules/_shared/zod";
import type { z } from "zod";
import type {
  CaseStudy,
  ClientLogo,
  Faq,
  LandingChapter,
  LegalPage,
  LegalPageVersion,
  Service,
  Testimonial,
} from "../../../drizzle/schema/content";
import { createCaseStudyOps, type CaseStudyMutation } from "./case-studies";
import type {
  ContentService,
  UpsertCaseStudyInput,
  UpsertClientLogoInput,
  UpsertFaqInput,
  UpsertLandingChapterInput,
  UpsertServiceInput,
  UpdateLegalPageInput,
  SetFeaturedProductsInput,
  getCaseStudyBySlugSchema,
  getLegalPageSchema,
  listCaseStudiesSchema,
  listFaqsSchema,
  listTestimonialsSchema,
  publishLegalPageSchema,
} from "./contracts";
import { type ContentDeps, withDefaults } from "./deps";
import { notFound, reader } from "./internal";
import { createLandingOps } from "./landing";
import { createLegalOps } from "./legal";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import { createServiceOps } from "./services";
import { createTestimonialOps } from "./testimonials";
import type {
  CaseStudyCard,
  CaseStudyDetail,
  ClientLogoView,
  FaqScope,
  FaqView,
  LandingContent,
  LegalPageKey,
  LegalPageView,
  ServiceView,
  TestimonialView,
} from "./types";
import {
  caseStudyCard,
  caseStudyDetail,
  clientLogoView,
  faqView,
  landingChapterView,
  legalPageView,
  loadMediaMap,
  organizationJsonLd,
  serviceView,
  testimonialView,
} from "./views";

type Id = { id: string };
type Reorder = { ids: string[] };

/** Mutation results carry what the action needs for dynamic cache tags (`product:<slug>` …). */
export interface ContentServiceImpl extends ContentService {
  upsertCaseStudy(ctx: RequestContext, input: UpsertCaseStudyInput, tx?: DbOrTx): Promise<CaseStudyMutation>;
  publishCaseStudy(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<CaseStudyMutation>;
  unpublishCaseStudy(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<CaseStudyMutation>;
  deleteCaseStudy(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<void>;
  deleteCaseStudyReturningSlug(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<{ slug: string }>;
  upsertTestimonial(
    ctx: RequestContext,
    input: UpsertTestimonialInput,
    tx?: DbOrTx,
  ): Promise<{ testimonial: Testimonial; productSlug: string | null }>;
  deleteTestimonialReturningSlug(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<{ productSlug: string | null }>;
  upsertFaq(ctx: RequestContext, input: UpsertFaqInput, tx?: DbOrTx): Promise<{ faq: Faq; productSlug: string | null }>;
  deleteFaqReturningSlug(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<{ productSlug: string | null }>;

  /* --- admin reads (`content.read`) --------------------------------------------------- */
  listLandingChaptersAdmin(ctx: RequestContext, tx?: DbOrTx): Promise<LandingChapter[]>;
  listFeaturedProductsAdmin(
    ctx: RequestContext,
    tx?: DbOrTx,
  ): Promise<{ productId: string; position: number; slug: string; name: string; status: string }[]>;
  listServicesAdmin(ctx: RequestContext, tx?: DbOrTx): Promise<Service[]>;
  listCaseStudiesAdmin(ctx: RequestContext, tx?: DbOrTx): Promise<CaseStudy[]>;
  listTestimonialsAdmin(ctx: RequestContext, tx?: DbOrTx): Promise<Testimonial[]>;
  listClientLogosAdmin(ctx: RequestContext, tx?: DbOrTx): Promise<ClientLogo[]>;
  listFaqsAdmin(ctx: RequestContext, input: { scope?: FaqScope }, tx?: DbOrTx): Promise<Faq[]>;
  listLegalPagesAdmin(ctx: RequestContext, tx?: DbOrTx): Promise<(LegalPage & { versionCount: number })[]>;
  listLegalPageVersions(ctx: RequestContext, input: { key: LegalPageKey }, tx?: DbOrTx): Promise<LegalPageVersion[]>;
  /** Live slug for a retired case-study slug (route 301), `null` when unknown. */
  resolveCaseStudySlug(ctx: Context, input: { slug: string }, tx?: DbOrTx): Promise<{ slug: string | null }>;
  /** Published featured products in landing order (ids + slugs). */
  listFeaturedProductIds(ctx: Context, tx?: DbOrTx): Promise<{ productId: string; slug: string }[]>;
}

type UpsertTestimonialInput = Parameters<ContentService["upsertTestimonial"]>[1];

export function createContentService(partial: Partial<ContentDeps> = {}): ContentServiceImpl {
  const deps = withDefaults(partial);
  const landing = createLandingOps(deps);
  const svc = createServiceOps(deps);
  const cs = createCaseStudyOps(deps);
  const tl = createTestimonialOps(deps);
  const legal = createLegalOps(deps);
  const viewCtx = async (db: DbOrTx, ids: readonly (string | null | undefined)[]) => ({
    media: await loadMediaMap(db, ids),
    mediaUrl: deps.mediaUrl,
  });

  const service: ContentServiceImpl = {
    /* --- API-CONT-01 / 02 ---------------------------------------------------------------- */
    upsertLandingChapter: (ctx, input: UpsertLandingChapterInput, tx) => landing.upsertLandingChapter(ctx, input, tx),
    setFeaturedProducts: (ctx, input: SetFeaturedProductsInput, tx) => landing.setFeaturedProducts(ctx, input, tx),

    /* --- API-CONT-03 --------------------------------------------------------------------- */
    upsertService: (ctx, input: UpsertServiceInput, tx) => svc.upsertService(ctx, input, tx),
    deleteService: (ctx, input, tx) => svc.deleteService(ctx, input, tx),
    reorderServices: (ctx, input: Reorder, tx) => svc.reorderServices(ctx, input, tx),

    /* --- API-CONT-04 --------------------------------------------------------------------- */
    upsertCaseStudy: (ctx, input, tx) => cs.upsertCaseStudy(ctx, input, tx),
    publishCaseStudy: (ctx, input, tx) => cs.publishCaseStudy(ctx, input, tx),
    unpublishCaseStudy: (ctx, input, tx) => cs.unpublishCaseStudy(ctx, input, tx),
    deleteCaseStudy: async (ctx, input, tx) => {
      await cs.deleteCaseStudy(ctx, input, tx);
    },
    deleteCaseStudyReturningSlug: (ctx, input, tx) => cs.deleteCaseStudy(ctx, input, tx),

    /* --- API-CONT-05 --------------------------------------------------------------------- */
    upsertTestimonial: (ctx, input, tx) => tl.upsertTestimonial(ctx, input, tx),
    deleteTestimonial: async (ctx, input, tx) => {
      await tl.deleteTestimonial(ctx, input, tx);
    },
    deleteTestimonialReturningSlug: (ctx, input, tx) => tl.deleteTestimonial(ctx, input, tx),
    reorderTestimonials: (ctx, input: Reorder, tx) => tl.reorderTestimonials(ctx, input, tx),

    /* --- API-CONT-06 --------------------------------------------------------------------- */
    upsertClientLogo: (ctx, input: UpsertClientLogoInput, tx) => tl.upsertClientLogo(ctx, input, tx),
    deleteClientLogo: (ctx, input, tx) => tl.deleteClientLogo(ctx, input, tx),
    reorderClientLogos: (ctx, input: Reorder, tx) => tl.reorderClientLogos(ctx, input, tx),

    /* --- API-CONT-07 --------------------------------------------------------------------- */
    upsertFaq: (ctx, input, tx) => tl.upsertFaq(ctx, input, tx),
    deleteFaq: async (ctx, input, tx) => {
      await tl.deleteFaq(ctx, input, tx);
    },
    deleteFaqReturningSlug: (ctx, input, tx) => tl.deleteFaq(ctx, input, tx),
    reorderFaqs: (ctx, input: Reorder, tx) => tl.reorderFaqs(ctx, input, tx),

    /* --- API-CONT-08 --------------------------------------------------------------------- */
    updateLegalPage: (ctx, input: UpdateLegalPageInput, tx) => legal.updateLegalPage(ctx, input, tx),
    publishLegalPage: (ctx, input: z.infer<typeof publishLegalPageSchema>, tx) => legal.publishLegalPage(ctx, input, tx),

    /* --- API-CONT-09 public reads ---------------------------------------------------------- */
    async getLandingContent(_ctx: Context, tx?: DbOrTx): Promise<LandingContent> {
      const db = reader(tx);
      const [chapters, services, testimonials, logos, faqs] = await Promise.all([
        landing.listLandingChaptersAdmin(db).then((rows) => rows.filter((r) => r.published)),
        svc.listPublishedServices(db),
        tl.listPublishedTestimonials({ context: "site" }, db),
        tl.listPublishedClientLogos(db),
        tl.listPublishedFaqs({ scope: "site" }, db),
      ]);
      const v = await viewCtx(db, [
        ...chapters.map((c) => c.media?.posterMediaId),
        ...testimonials.map((t) => t.row.avatarMediaId),
        ...logos.map((l) => l.mediaId),
      ]);
      return {
        chapters: chapters.map((c) => landingChapterView(c, v)),
        services: services.map(serviceView),
        testimonials: testimonials.map((t) => testimonialView(t.row, v, t.productSlug)),
        logos: logos.map((l) => clientLogoView(l, v)).filter((l): l is ClientLogoView => l !== null),
        faqs: faqs.map((f) => faqView(f.row, f.productSlug)),
        jsonLd: organizationJsonLd(),
      };
    },

    async listServices(_ctx: Context, tx?: DbOrTx): Promise<ServiceView[]> {
      return (await svc.listPublishedServices(tx)).map(serviceView);
    },

    async listCaseStudies(
      _ctx: Context,
      input: z.infer<typeof listCaseStudiesSchema>,
      tx?: DbOrTx,
    ): Promise<ListResult<CaseStudyCard>> {
      const page = await cs.listPublished(input, tx);
      const v = await viewCtx(reader(tx), page.items.map((r) => r.coverMediaId));
      return { ...page, items: page.items.map((r) => caseStudyCard(r, v)) };
    },

    async getCaseStudyBySlug(
      _ctx: Context,
      input: z.infer<typeof getCaseStudyBySlugSchema>,
      tx?: DbOrTx,
    ): Promise<CaseStudyDetail> {
      const row = await cs.findPublishedBySlug(input.slug, tx);
      if (row === undefined) throw notFound("case study");
      const v = await viewCtx(reader(tx), [row.coverMediaId, ...(row.gallery ?? []).map((g) => g.mediaId)]);
      return caseStudyDetail(row, v);
    },

    async listTestimonials(
      _ctx: Context,
      input: z.infer<typeof listTestimonialsSchema>,
      tx?: DbOrTx,
    ): Promise<TestimonialView[]> {
      const rows = await tl.listPublishedTestimonials(input, tx);
      const v = await viewCtx(reader(tx), rows.map((r) => r.row.avatarMediaId));
      return rows.map((r) => testimonialView(r.row, v, r.productSlug));
    },

    async listClientLogos(_ctx: Context, tx?: DbOrTx): Promise<ClientLogoView[]> {
      const rows = await tl.listPublishedClientLogos(tx);
      const v = await viewCtx(reader(tx), rows.map((r) => r.mediaId));
      return rows.map((r) => clientLogoView(r, v)).filter((l): l is ClientLogoView => l !== null);
    },

    async listFaqs(_ctx: Context, input: z.infer<typeof listFaqsSchema>, tx?: DbOrTx): Promise<FaqView[]> {
      return (await tl.listPublishedFaqs(input, tx)).map((r) => faqView(r.row, r.productSlug));
    },

    async getLegalPage(_ctx: Context, input: z.infer<typeof getLegalPageSchema>, tx?: DbOrTx): Promise<LegalPageView> {
      const found = await legal.findLatestPublished(input.key, tx);
      if (found === undefined) throw notFound("legal page");
      return legalPageView(found.page, found.version);
    },

    /* --- admin reads ------------------------------------------------------------------------ */
    listLandingChaptersAdmin: (_ctx, tx) => landing.listLandingChaptersAdmin(tx),
    listFeaturedProductsAdmin: (_ctx, tx) => landing.listFeaturedProductsAdmin(tx),
    listServicesAdmin: (_ctx, tx) => svc.listServicesAdmin(tx),
    listCaseStudiesAdmin: (_ctx, tx) => cs.listCaseStudiesAdmin(tx),
    listTestimonialsAdmin: (_ctx, tx) => tl.listTestimonialsAdmin(tx),
    listClientLogosAdmin: (_ctx, tx) => tl.listClientLogosAdmin(tx),
    listFaqsAdmin: (_ctx, input, tx) => tl.listFaqsAdmin(input, tx),
    listLegalPagesAdmin: (_ctx, tx) => legal.listLegalPagesAdmin(tx),
    listLegalPageVersions: (_ctx, input, tx) => legal.listLegalPageVersions(input.key, tx),
    resolveCaseStudySlug: async (_ctx, input, tx) => ({ slug: await cs.resolveSlug(input.slug, tx) }),
    listFeaturedProductIds: (_ctx, tx) => landing.listFeaturedProductIds(tx),
  };
  return service;
}

/** Production singleton (pooled `db`, real audit port). */
export const contentService: ContentServiceImpl = createContentService();

/** Kept for the P2.8 stub tests until every module is live. */
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
