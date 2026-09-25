/**
 * Content service implementation (docs/06 §2.10 API-CONT-01..09; MASTER_SPEC §4.10; PHASE-03 P3.11).
 *
 * Implements ContentService with:
 * - Landing chapters (five fixed keys, rich text, media & CTA)
 * - Featured products (cap of 8, published only, revalidates content + catalog)
 * - Services (CRUD, slug uniqueness, deliverables, reorder)
 * - Case studies (CRUD, slug redirects, gallery, publish/unpublish)
 * - Testimonials (site/product scoped, avatar resolution)
 * - Client logos (media resolution, reorder)
 * - FAQs (site/chatbot/product scoped, rich text rendered)
 * - Legal pages (draft updates, publish with version += 1 and immutable history snapshot)
 * - Public reads with server-side rendered HTML and JSON-LD schema
 */
import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Context, RequestContext } from "@/lib/authz/context";
import { assertPermission } from "@/lib/authz/assert";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { revalidateTagsSafe } from "@/lib/revalidate";
import { triggerReindexSafe } from "@/modules/search/indexer";
import { getPublicMediaBaseUrl } from "@/lib/storage";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { ListResult, RichTextDoc } from "@/modules/_shared/zod";
import {
  caseStudies,
  clientLogos,
  faqs,
  featuredProducts,
  landingChapters,
  legalPages,
  legalPageVersions,
  media,
  products,
  services,
  slugRedirects,
  testimonials,
} from "../../../drizzle/schema";
import { renderToHtml } from "./render";
import type {
  ContentService,
  Reorder,
  SetFeaturedProductsInput,
  UpdateLegalPageInput,
  UpsertCaseStudyInput,
  UpsertClientLogoInput,
  UpsertFaqInput,
  UpsertLandingChapterInput,
  UpsertServiceInput,
  UpsertTestimonialInput,
  getCaseStudyBySlugSchema,
  getLegalPageSchema,
  listCaseStudiesSchema,
  listFaqsSchema,
  listTestimonialsSchema,
  publishLegalPageSchema,
} from "./contracts";
import type {
  CaseStudy,
  CaseStudyCard,
  CaseStudyDetail,
  ClientLogo,
  ClientLogoView,
  Faq,
  FaqView,
  LandingChapter,
  LandingChapterKey,
  LandingChapterView,
  LandingContent,
  LegalPage,
  LegalPageVersion,
  LegalPageView,
  Service,
  ServiceView,
  Testimonial,
  TestimonialView,
} from "./types";
import { FEATURED_PRODUCTS_MAX } from "./types";
import type { ImageRef } from "../catalog/types";
import { z } from "zod";

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.getTime()}#${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { epochMs: number; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const [msStr, id] = raw.split("#");
    if (!msStr || !id) return null;
    const epochMs = Number(msStr);
    if (isNaN(epochMs)) return null;
    return { epochMs, id };
  } catch {
    return null;
  }
}

function resolveMediaUrl(
  m: { id: string; objectKey: string; visibility: string } | null,
): string | null {
  if (!m) return null;
  if (m.visibility === "public") {
    const baseUrl = getPublicMediaBaseUrl().replace(/\/+$/, "");
    return `${baseUrl}/${m.objectKey}`;
  }
  return `/api/files/private/${m.id}`;
}

export class DefaultContentService implements ContentService {
  constructor(private readonly getDb?: () => DbOrTx) {}

  private async getDatabase(tx?: DbOrTx): Promise<DbOrTx> {
    if (tx) return tx;
    if (this.getDb) return this.getDb();
    const { db } = await import("@/lib/db");
    return db;
  }

  /* --- API-CONT-01 Landing Chapters --------------------------------------------------------- */

  async upsertLandingChapter(
    ctx: RequestContext,
    input: UpsertLandingChapterInput,
    tx?: DbOrTx,
  ): Promise<{ chapter: LandingChapter }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    const [existing] = await client
      .select()
      .from(landingChapters)
      .where(eq(landingChapters.key, input.key))
      .limit(1);

    let chapter: LandingChapter;

    if (existing) {
      const [updated] = await client
        .update(landingChapters)
        .set({
          title: input.title,
          subtitle: input.subtitle ?? null,
          bodyJson: input.bodyJson,
          media: input.media,
          cta: input.cta,
          position: input.position,
          published: input.published,
          updatedAt: new Date(),
        })
        .where(eq(landingChapters.id, existing.id))
        .returning();

      if (!updated) throw new AppError(ErrorCode.INTERNAL, "Failed to update landing chapter");
      chapter = updated;
    } else {
      const [inserted] = await client
        .insert(landingChapters)
        .values({
          key: input.key,
          title: input.title,
          subtitle: input.subtitle ?? null,
          bodyJson: input.bodyJson,
          media: input.media,
          cta: input.cta,
          position: input.position,
          published: input.published,
        })
        .returning();

      if (!inserted) throw new AppError(ErrorCode.INTERNAL, "Failed to create landing chapter");
      chapter = inserted;
    }

    revalidateTagsSafe(["content"]);
    return { chapter };
  }

  /* --- API-CONT-02 Featured Products -------------------------------------------------------- */

  async setFeaturedProducts(
    ctx: RequestContext,
    input: SetFeaturedProductsInput,
    tx?: DbOrTx,
  ): Promise<{ featured: { productId: string; position: number }[] }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    if (input.productIds.length > FEATURED_PRODUCTS_MAX) {
      throw new AppError(
        ErrorCode.VALIDATION,
        `At most ${FEATURED_PRODUCTS_MAX} featured products allowed`,
      );
    }

    if (input.productIds.length > 0) {
      const prods = await client
        .select({ id: products.id, status: products.status })
        .from(products)
        .where(inArray(products.id, input.productIds));

      if (prods.length !== input.productIds.length) {
        throw new AppError(ErrorCode.VALIDATION, "One or more products not found");
      }

      const unpublished = prods.filter((p) => p.status !== "published");
      if (unpublished.length > 0) {
        throw new AppError(
          ErrorCode.VALIDATION,
          "All featured products must be in published status",
        );
      }
    }

    // Replace featured products in transaction
    await client.delete(featuredProducts);

    if (input.productIds.length > 0) {
      await client.insert(featuredProducts).values(
        input.productIds.map((productId, position) => ({
          productId,
          position,
        })),
      );
    }

    revalidateTagsSafe(["content", "catalog"]);
    return {
      featured: input.productIds.map((productId, position) => ({
        productId,
        position,
      })),
    };
  }

  /* --- API-CONT-03 Services ----------------------------------------------------------------- */

  async upsertService(
    ctx: RequestContext,
    input: UpsertServiceInput,
    tx?: DbOrTx,
  ): Promise<{ service: Service }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    const [existingSlug] = await client
      .select({ id: services.id })
      .from(services)
      .where(eq(services.slug, input.slug))
      .limit(1);

    if (existingSlug && (!input.id || existingSlug.id !== input.id)) {
      throw new AppError(ErrorCode.CONFLICT, `Service slug '${input.slug}' already in use`);
    }

    let service: Service;

    if (input.id) {
      const [updated] = await client
        .update(services)
        .set({
          slug: input.slug,
          title: input.title,
          summary: input.summary ?? null,
          deliverables: input.deliverables,
          bodyJson: input.bodyJson,
          icon: input.icon ?? null,
          position: input.position,
          published: input.published,
          updatedAt: new Date(),
        })
        .where(eq(services.id, input.id))
        .returning();

      if (!updated) throw new AppError(ErrorCode.NOT_FOUND, "Service not found");
      service = updated;
    } else {
      const [inserted] = await client
        .insert(services)
        .values({
          slug: input.slug,
          title: input.title,
          summary: input.summary ?? null,
          deliverables: input.deliverables,
          bodyJson: input.bodyJson,
          icon: input.icon ?? null,
          position: input.position,
          published: input.published,
        })
        .returning();

      if (!inserted) throw new AppError(ErrorCode.INTERNAL, "Failed to create service");
      service = inserted;
    }

    revalidateTagsSafe(["content"]);
    await triggerReindexSafe("service", service.id, client);
    return { service };
  }

  async deleteService(ctx: RequestContext, input: { id: string }, tx?: DbOrTx): Promise<void> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);
    await client.delete(services).where(eq(services.id, input.id));
    revalidateTagsSafe(["content"]);
    await triggerReindexSafe("service", input.id, client);
  }

  async reorderServices(
    ctx: RequestContext,
    input: Reorder,
    tx?: DbOrTx,
  ): Promise<{ services: Service[] }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    for (let i = 0; i < input.ids.length; i++) {
      const id = input.ids[i];
      if (id) {
        await client.update(services).set({ position: i }).where(eq(services.id, id));
      }
    }

    const rows = await client.select().from(services).orderBy(asc(services.position));
    revalidateTagsSafe(["content"]);
    return { services: rows };
  }

  /* --- API-CONT-04 Case Studies ------------------------------------------------------------- */

  async upsertCaseStudy(
    ctx: RequestContext,
    input: UpsertCaseStudyInput,
    tx?: DbOrTx,
  ): Promise<{ caseStudy: CaseStudy }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    const [existingSlug] = await client
      .select({ id: caseStudies.id })
      .from(caseStudies)
      .where(eq(caseStudies.slug, input.slug))
      .limit(1);

    if (existingSlug && (!input.id || existingSlug.id !== input.id)) {
      throw new AppError(ErrorCode.CONFLICT, `Case study slug '${input.slug}' already in use`);
    }

    let caseStudy: CaseStudy;

    if (input.id) {
      const [existing] = await client
        .select()
        .from(caseStudies)
        .where(eq(caseStudies.id, input.id))
        .limit(1);

      if (!existing) throw new AppError(ErrorCode.NOT_FOUND, "Case study not found");

      if (existing.slug !== input.slug && existing.published) {
        await client
          .insert(slugRedirects)
          .values({
            entity: "case_study",
            oldSlug: existing.slug,
            newSlug: input.slug,
          })
          .onConflictDoUpdate({
            target: [slugRedirects.entity, slugRedirects.oldSlug],
            set: { newSlug: input.slug, createdAt: new Date() },
          });
      }

      const [updated] = await client
        .update(caseStudies)
        .set({
          slug: input.slug,
          title: input.title,
          clientName: input.clientName ?? null,
          industry: input.industry ?? null,
          problemJson: input.problemJson,
          solutionJson: input.solutionJson,
          resultsJson: input.resultsJson,
          techStack: input.techStack,
          coverMediaId: input.coverMediaId,
          gallery: input.gallery,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          updatedAt: new Date(),
        })
        .where(eq(caseStudies.id, input.id))
        .returning();

      if (!updated) throw new AppError(ErrorCode.INTERNAL, "Failed to update case study");
      caseStudy = updated;
    } else {
      const [inserted] = await client
        .insert(caseStudies)
        .values({
          slug: input.slug,
          title: input.title,
          clientName: input.clientName ?? null,
          industry: input.industry ?? null,
          problemJson: input.problemJson,
          solutionJson: input.solutionJson,
          resultsJson: input.resultsJson,
          techStack: input.techStack,
          coverMediaId: input.coverMediaId,
          gallery: input.gallery,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          published: false,
        })
        .returning();

      if (!inserted) throw new AppError(ErrorCode.INTERNAL, "Failed to create case study");
      caseStudy = inserted;
    }

    revalidateTagsSafe(["case-studies", "sitemap", `case-study:${caseStudy.slug}`]);
    return { caseStudy };
  }

  async publishCaseStudy(
    ctx: RequestContext,
    input: { id: string },
    tx?: DbOrTx,
  ): Promise<{ caseStudy: CaseStudy }> {
    assertPermission(ctx, "content.publish");
    const client = await this.getDatabase(tx);

    const [existing] = await client
      .select()
      .from(caseStudies)
      .where(eq(caseStudies.id, input.id))
      .limit(1);

    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, "Case study not found");

    const [updated] = await client
      .update(caseStudies)
      .set({
        published: true,
        publishedAt: existing.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(caseStudies.id, input.id))
      .returning();

    if (!updated) throw new AppError(ErrorCode.INTERNAL, "Failed to publish case study");
    revalidateTagsSafe(["case-studies", "sitemap", `case-study:${updated.slug}`]);
    await triggerReindexSafe("case_study", updated.id, client);
    return { caseStudy: updated };
  }

  async unpublishCaseStudy(
    ctx: RequestContext,
    input: { id: string },
    tx?: DbOrTx,
  ): Promise<{ caseStudy: CaseStudy }> {
    assertPermission(ctx, "content.publish");
    const client = await this.getDatabase(tx);

    const [existing] = await client
      .select()
      .from(caseStudies)
      .where(eq(caseStudies.id, input.id))
      .limit(1);

    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, "Case study not found");

    const [updated] = await client
      .update(caseStudies)
      .set({
        published: false,
        updatedAt: new Date(),
      })
      .where(eq(caseStudies.id, input.id))
      .returning();

    if (!updated) throw new AppError(ErrorCode.INTERNAL, "Failed to unpublish case study");
    revalidateTagsSafe(["case-studies", "sitemap", `case-study:${updated.slug}`]);
    await triggerReindexSafe("case_study", updated.id, client);
    return { caseStudy: updated };
  }

  async deleteCaseStudy(ctx: RequestContext, input: { id: string }, tx?: DbOrTx): Promise<void> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);
    await client.delete(caseStudies).where(eq(caseStudies.id, input.id));
    revalidateTagsSafe(["case-studies", "sitemap"]);
  }

  /* --- API-CONT-05 Testimonials ------------------------------------------------------------- */

  async upsertTestimonial(
    ctx: RequestContext,
    input: UpsertTestimonialInput,
    tx?: DbOrTx,
  ): Promise<{ testimonial: Testimonial }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    if (input.context === "product") {
      if (!input.productId) {
        throw new AppError(ErrorCode.VALIDATION, "Product testimonials need a productId");
      }
      const [prod] = await client
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      if (!prod) throw new AppError(ErrorCode.VALIDATION, "Product not found");
    }

    let testimonial: Testimonial;

    if (input.id) {
      const [updated] = await client
        .update(testimonials)
        .set({
          quote: input.quote,
          authorName: input.authorName,
          authorTitle: input.authorTitle ?? null,
          company: input.company ?? null,
          avatarMediaId: input.avatarMediaId ?? null,
          context: input.context,
          productId: input.productId ?? null,
          position: input.position,
          published: input.published,
          updatedAt: new Date(),
        })
        .where(eq(testimonials.id, input.id))
        .returning();

      if (!updated) throw new AppError(ErrorCode.NOT_FOUND, "Testimonial not found");
      testimonial = updated;
    } else {
      const [inserted] = await client
        .insert(testimonials)
        .values({
          quote: input.quote,
          authorName: input.authorName,
          authorTitle: input.authorTitle ?? null,
          company: input.company ?? null,
          avatarMediaId: input.avatarMediaId ?? null,
          context: input.context,
          productId: input.productId ?? null,
          position: input.position,
          published: input.published,
        })
        .returning();

      if (!inserted) throw new AppError(ErrorCode.INTERNAL, "Failed to create testimonial");
      testimonial = inserted;
    }

    revalidateTagsSafe(["content"]);
    return { testimonial };
  }

  async deleteTestimonial(ctx: RequestContext, input: { id: string }, tx?: DbOrTx): Promise<void> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);
    await client.delete(testimonials).where(eq(testimonials.id, input.id));
    revalidateTagsSafe(["content"]);
  }

  async reorderTestimonials(
    ctx: RequestContext,
    input: Reorder,
    tx?: DbOrTx,
  ): Promise<{ testimonials: Testimonial[] }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    for (let i = 0; i < input.ids.length; i++) {
      const id = input.ids[i];
      if (id) {
        await client.update(testimonials).set({ position: i }).where(eq(testimonials.id, id));
      }
    }

    const rows = await client.select().from(testimonials).orderBy(asc(testimonials.position));
    revalidateTagsSafe(["content"]);
    return { testimonials: rows };
  }

  /* --- API-CONT-06 Client Logos ------------------------------------------------------------- */

  async upsertClientLogo(
    ctx: RequestContext,
    input: UpsertClientLogoInput,
    tx?: DbOrTx,
  ): Promise<{ logo: ClientLogo }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    let logo: ClientLogo;

    if (input.id) {
      const [updated] = await client
        .update(clientLogos)
        .set({
          name: input.name,
          mediaId: input.mediaId,
          url: input.url ?? null,
          position: input.position,
          published: input.published,
          updatedAt: new Date(),
        })
        .where(eq(clientLogos.id, input.id))
        .returning();

      if (!updated) throw new AppError(ErrorCode.NOT_FOUND, "Client logo not found");
      logo = updated;
    } else {
      const [inserted] = await client
        .insert(clientLogos)
        .values({
          name: input.name,
          mediaId: input.mediaId,
          url: input.url ?? null,
          position: input.position,
          published: input.published,
        })
        .returning();

      if (!inserted) throw new AppError(ErrorCode.INTERNAL, "Failed to create client logo");
      logo = inserted;
    }

    revalidateTagsSafe(["content"]);
    return { logo };
  }

  async deleteClientLogo(ctx: RequestContext, input: { id: string }, tx?: DbOrTx): Promise<void> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);
    await client.delete(clientLogos).where(eq(clientLogos.id, input.id));
    revalidateTagsSafe(["content"]);
  }

  async reorderClientLogos(
    ctx: RequestContext,
    input: Reorder,
    tx?: DbOrTx,
  ): Promise<{ logos: ClientLogo[] }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    for (let i = 0; i < input.ids.length; i++) {
      const id = input.ids[i];
      if (id) {
        await client.update(clientLogos).set({ position: i }).where(eq(clientLogos.id, id));
      }
    }

    const rows = await client.select().from(clientLogos).orderBy(asc(clientLogos.position));
    revalidateTagsSafe(["content"]);
    return { logos: rows };
  }

  /* --- API-CONT-07 FAQs --------------------------------------------------------------------- */

  async upsertFaq(ctx: RequestContext, input: UpsertFaqInput, tx?: DbOrTx): Promise<{ faq: Faq }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    if (input.scope === "product") {
      if (!input.productId) {
        throw new AppError(ErrorCode.VALIDATION, "Product FAQs need a productId");
      }
      const [prod] = await client
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      if (!prod) throw new AppError(ErrorCode.VALIDATION, "Product not found");
    }

    let faq: Faq;

    if (input.id) {
      const [updated] = await client
        .update(faqs)
        .set({
          question: input.question,
          answerJson: input.answerJson,
          scope: input.scope,
          productId: input.productId ?? null,
          position: input.position,
          published: input.published,
          updatedAt: new Date(),
        })
        .where(eq(faqs.id, input.id))
        .returning();

      if (!updated) throw new AppError(ErrorCode.NOT_FOUND, "FAQ not found");
      faq = updated;
    } else {
      const [inserted] = await client
        .insert(faqs)
        .values({
          question: input.question,
          answerJson: input.answerJson,
          scope: input.scope,
          productId: input.productId ?? null,
          position: input.position,
          published: input.published,
        })
        .returning();

      if (!inserted) throw new AppError(ErrorCode.INTERNAL, "Failed to create FAQ");
      faq = inserted;
    }

    revalidateTagsSafe(["content"]);
    await triggerReindexSafe("faq", faq.id, client);
    return { faq };
  }

  async deleteFaq(ctx: RequestContext, input: { id: string }, tx?: DbOrTx): Promise<void> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);
    await client.delete(faqs).where(eq(faqs.id, input.id));
    revalidateTagsSafe(["content"]);
    await triggerReindexSafe("faq", input.id, client);
  }

  async reorderFaqs(ctx: RequestContext, input: Reorder, tx?: DbOrTx): Promise<{ faqs: Faq[] }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    for (let i = 0; i < input.ids.length; i++) {
      const id = input.ids[i];
      if (id) {
        await client.update(faqs).set({ position: i }).where(eq(faqs.id, id));
      }
    }

    const rows = await client.select().from(faqs).orderBy(asc(faqs.position));
    revalidateTagsSafe(["content"]);
    return { faqs: rows };
  }

  /* --- API-CONT-08 Legal Pages -------------------------------------------------------------- */

  async updateLegalPage(
    ctx: RequestContext,
    input: UpdateLegalPageInput,
    tx?: DbOrTx,
  ): Promise<{ page: LegalPage }> {
    assertPermission(ctx, "content.write");
    const client = await this.getDatabase(tx);

    const [existing] = await client
      .select()
      .from(legalPages)
      .where(eq(legalPages.key, input.key))
      .limit(1);

    let page: LegalPage;

    if (existing) {
      const [updated] = await client
        .update(legalPages)
        .set({
          title: input.title,
          bodyJson: input.bodyJson,
          updatedAt: new Date(),
        })
        .where(eq(legalPages.id, existing.id))
        .returning();

      if (!updated) throw new AppError(ErrorCode.INTERNAL, "Failed to update legal page");
      page = updated;
    } else {
      const [inserted] = await client
        .insert(legalPages)
        .values({
          key: input.key,
          title: input.title,
          bodyJson: input.bodyJson,
          version: 1,
        })
        .returning();

      if (!inserted) throw new AppError(ErrorCode.INTERNAL, "Failed to create legal page");
      page = inserted;
    }

    revalidateTagsSafe(["content"]);
    return { page };
  }

  async publishLegalPage(
    ctx: RequestContext,
    input: z.infer<typeof publishLegalPageSchema>,
    tx?: DbOrTx,
  ): Promise<{ page: LegalPage; version: LegalPageVersion }> {
    assertPermission(ctx, "content.publish");
    const client = await this.getDatabase(tx);

    const [existing] = await client
      .select()
      .from(legalPages)
      .where(eq(legalPages.key, input.key))
      .limit(1);

    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, "Legal page not found");

    const newVersion = existing.publishedAt ? existing.version + 1 : existing.version;

    const [updatedPage] = await client
      .update(legalPages)
      .set({
        version: newVersion,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(legalPages.id, existing.id))
      .returning();

    if (!updatedPage) throw new AppError(ErrorCode.INTERNAL, "Failed to update legal page");

    const [versionRow] = await client
      .insert(legalPageVersions)
      .values({
        legalPageId: existing.id,
        version: newVersion,
        bodyJson: existing.bodyJson,
        publishedAt: new Date(),
        publishedBy: ctx.userId,
      })
      .returning();

    if (!versionRow)
      throw new AppError(ErrorCode.INTERNAL, "Failed to snapshot legal page version");

    revalidateTagsSafe(["content"]);
    await triggerReindexSafe("legal", existing.id, client);
    return { page: updatedPage, version: versionRow };
  }

  /* --- API-CONT-09 Public Reads ------------------------------------------------------------- */

  async getLandingContent(ctx: Context, tx?: DbOrTx): Promise<LandingContent> {
    const client = await this.getDatabase(tx);

    // 1. Landing chapters
    const chapterRows = await client
      .select()
      .from(landingChapters)
      .orderBy(asc(landingChapters.position));

    const chapters: LandingChapterView[] = [];
    for (const c of chapterRows) {
      let poster: ImageRef | null = null;
      if (c.media?.posterMediaId) {
        const [m] = await client
          .select()
          .from(media)
          .where(eq(media.id, c.media.posterMediaId))
          .limit(1);
        if (m) {
          const posterUrl = resolveMediaUrl(m);
          poster = {
            mediaId: m.id,
            url: posterUrl ?? "",
            alt: c.title,
            width: m.width,
            height: m.height,
            blurHash: m.blurHash,
          };
        }
      }

      chapters.push({
        key: c.key as LandingChapterKey,
        title: c.title,
        subtitle: c.subtitle,
        html: renderToHtml(c.bodyJson as unknown as RichTextDoc),
        media: {
          poster,
          videoEmbedUrl: c.media?.videoEmbedUrl ?? null,
          sceneVariant: c.media?.sceneVariant ?? null,
        },
        cta: c.cta,
        position: c.position,
      });
    }

    // 2. Services
    const serviceViews = await this.listServices(ctx, tx);

    // 3. Testimonials (site context)
    const testimonialViews = await this.listTestimonials(ctx, { context: "site" }, tx);

    // 4. Client logos
    const logoViews = await this.listClientLogos(ctx, tx);

    // 5. FAQs (site scope)
    const faqViews = await this.listFaqs(ctx, { scope: "site" }, tx);

    // 6. JSON-LD Organization
    const domain = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
      : "codekraft.dev";

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `https://${domain}/#organization`,
          name: "CodeKraft",
          url: `https://${domain}/`,
          description:
            "CodeKraft builds software, websites and products for clients and sells its own digital products.",
        },
        {
          "@type": "WebSite",
          "@id": `https://${domain}/#website`,
          url: `https://${domain}/`,
          name: "CodeKraft",
          publisher: { "@id": `https://${domain}/#organization` },
        },
      ],
    };

    return {
      chapters,
      services: serviceViews,
      testimonials: testimonialViews,
      logos: logoViews,
      faqs: faqViews,
      jsonLd,
    };
  }

  async listServices(ctx: Context, tx?: DbOrTx): Promise<ServiceView[]> {
    const client = await this.getDatabase(tx);

    const rows = await client
      .select()
      .from(services)
      .where(eq(services.published, true))
      .orderBy(asc(services.position));

    return rows.map((s: (typeof rows)[number]) => ({
      slug: s.slug,
      title: s.title,
      summary: s.summary,
      deliverables: s.deliverables ?? [],
      html: renderToHtml(s.bodyJson as unknown as RichTextDoc),
      icon: s.icon,
      position: s.position,
    }));
  }

  async listCaseStudies(
    ctx: Context,
    input: z.infer<typeof listCaseStudiesSchema>,
    tx?: DbOrTx,
  ): Promise<ListResult<CaseStudyCard>> {
    const client = await this.getDatabase(tx);
    const limit = input.limit ?? 25;
    const isAsc = input.sort?.endsWith(":asc") ?? false;

    const conditions = [eq(caseStudies.published, true)];

    if (input.filters?.industry) {
      conditions.push(eq(caseStudies.industry, input.filters.industry));
    }

    if (input.cursor) {
      const decoded = decodeCursor(input.cursor);
      if (decoded) {
        const cursorCond = isAsc
          ? or(
              sql`extract(epoch from ${caseStudies.publishedAt}) * 1000 > ${decoded.epochMs}`,
              and(
                sql`floor(extract(epoch from ${caseStudies.publishedAt}) * 1000) = ${decoded.epochMs}`,
                sql`${caseStudies.id} > ${decoded.id}::uuid`,
              ),
            )
          : or(
              sql`extract(epoch from ${caseStudies.publishedAt}) * 1000 < ${decoded.epochMs}`,
              and(
                sql`floor(extract(epoch from ${caseStudies.publishedAt}) * 1000) = ${decoded.epochMs}`,
                sql`${caseStudies.id} < ${decoded.id}::uuid`,
              ),
            );
        if (cursorCond) {
          conditions.push(cursorCond);
        }
      }
    }

    const orderCols = isAsc
      ? [asc(caseStudies.publishedAt), asc(caseStudies.id)]
      : [desc(caseStudies.publishedAt), desc(caseStudies.id)];

    const rows = await client
      .select({
        caseStudy: caseStudies,
        media: media,
      })
      .from(caseStudies)
      .leftJoin(media, eq(caseStudies.coverMediaId, media.id))
      .where(and(...conditions))
      .orderBy(...orderCols)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const itemsRows = hasMore ? rows.slice(0, limit) : rows;

    const [totalRow] = await client
      .select({ total: count() })
      .from(caseStudies)
      .where(
        input.filters?.industry
          ? and(eq(caseStudies.published, true), eq(caseStudies.industry, input.filters.industry))
          : eq(caseStudies.published, true),
      );

    const items: CaseStudyCard[] = itemsRows.map((r: (typeof rows)[number]) => {
      const coverUrl = resolveMediaUrl(r.media);
      const coverRef: ImageRef | null = r.media
        ? {
            mediaId: r.media.id,
            url: coverUrl ?? "",
            alt: r.caseStudy.title,
            width: r.media.width,
            height: r.media.height,
            blurHash: r.media.blurHash,
          }
        : null;

      return {
        slug: r.caseStudy.slug,
        title: r.caseStudy.title,
        clientName: r.caseStudy.clientName,
        industry: r.caseStudy.industry,
        techStack: r.caseStudy.techStack ?? [],
        cover: coverRef,
        publishedAt: r.caseStudy.publishedAt ? r.caseStudy.publishedAt.toISOString() : null,
      };
    });

    const lastItem = itemsRows[itemsRows.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.caseStudy.publishedAt
        ? encodeCursor(new Date(lastItem.caseStudy.publishedAt), lastItem.caseStudy.id)
        : null;

    return {
      items,
      nextCursor,
      total: totalRow?.total ?? items.length,
    };
  }

  async getCaseStudyBySlug(
    ctx: Context,
    input: z.infer<typeof getCaseStudyBySlugSchema>,
    tx?: DbOrTx,
  ): Promise<CaseStudyDetail> {
    const client = await this.getDatabase(tx);

    let [row] = await client
      .select({
        caseStudy: caseStudies,
        media: media,
      })
      .from(caseStudies)
      .leftJoin(media, eq(caseStudies.coverMediaId, media.id))
      .where(eq(caseStudies.slug, input.slug))
      .limit(1);

    if (!row) {
      const [redirect] = await client
        .select()
        .from(slugRedirects)
        .where(and(eq(slugRedirects.entity, "case_study"), eq(slugRedirects.oldSlug, input.slug)))
        .limit(1);

      if (redirect) {
        [row] = await client
          .select({
            caseStudy: caseStudies,
            media: media,
          })
          .from(caseStudies)
          .leftJoin(media, eq(caseStudies.coverMediaId, media.id))
          .where(eq(caseStudies.slug, redirect.newSlug))
          .limit(1);
      }
    }

    if (!row || !row.caseStudy.published) {
      throw new AppError(ErrorCode.NOT_FOUND, "Case study not found");
    }

    const coverUrl = resolveMediaUrl(row.media);
    const coverRef: ImageRef | null = row.media
      ? {
          mediaId: row.media.id,
          url: coverUrl ?? "",
          alt: row.caseStudy.title,
          width: row.media.width,
          height: row.media.height,
          blurHash: row.media.blurHash,
        }
      : null;

    // Gallery images
    const galleryItems: (ImageRef & { caption: string | null })[] = [];
    if (row.caseStudy.gallery && row.caseStudy.gallery.length > 0) {
      for (const item of row.caseStudy.gallery) {
        const [m] = await client.select().from(media).where(eq(media.id, item.mediaId)).limit(1);
        if (m) {
          const url = resolveMediaUrl(m);
          galleryItems.push({
            mediaId: m.id,
            url: url ?? "",
            alt: item.alt,
            width: m.width,
            height: m.height,
            blurHash: m.blurHash,
            caption: item.caption ?? null,
          });
        }
      }
    }

    const domain = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
      : "codekraft.dev";

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `https://${domain}/projects/${row.caseStudy.slug}#article`,
      headline: row.caseStudy.title,
      description: row.caseStudy.seoDescription ?? "",
      image: coverUrl ? [coverUrl] : [],
      datePublished: row.caseStudy.publishedAt
        ? new Date(row.caseStudy.publishedAt).toISOString()
        : new Date().toISOString(),
      dateModified: new Date(row.caseStudy.updatedAt).toISOString(),
      author: { "@id": `https://${domain}/#organization` },
      publisher: { "@id": `https://${domain}/#organization` },
      mainEntityOfPage: `https://${domain}/projects/${row.caseStudy.slug}`,
      isPartOf: { "@id": `https://${domain}/#website` },
      inLanguage: "en",
    };

    return {
      slug: row.caseStudy.slug,
      title: row.caseStudy.title,
      clientName: row.caseStudy.clientName,
      industry: row.caseStudy.industry,
      techStack: row.caseStudy.techStack ?? [],
      cover: coverRef,
      publishedAt: row.caseStudy.publishedAt ? row.caseStudy.publishedAt.toISOString() : null,
      problemHtml: renderToHtml(row.caseStudy.problemJson as unknown as RichTextDoc),
      solutionHtml: renderToHtml(row.caseStudy.solutionJson as unknown as RichTextDoc),
      resultsHtml: renderToHtml(row.caseStudy.resultsJson as unknown as RichTextDoc),
      gallery: galleryItems,
      seo: {
        title: row.caseStudy.seoTitle ?? row.caseStudy.title,
        description: row.caseStudy.seoDescription ?? "",
      },
      jsonLd,
    };
  }

  async listTestimonials(
    ctx: Context,
    input: z.infer<typeof listTestimonialsSchema>,
    tx?: DbOrTx,
  ): Promise<TestimonialView[]> {
    const client = await this.getDatabase(tx);

    const query = client
      .select({
        testimonial: testimonials,
        media: media,
        productSlug: products.slug,
      })
      .from(testimonials)
      .leftJoin(media, eq(testimonials.avatarMediaId, media.id))
      .leftJoin(products, eq(testimonials.productId, products.id))
      .where(
        and(
          eq(testimonials.published, true),
          eq(testimonials.context, input.context),
          input.productSlug ? eq(products.slug, input.productSlug) : sql`true`,
        ),
      )
      .orderBy(asc(testimonials.position));

    const rows = await query;

    return rows.map((r: (typeof rows)[number]) => {
      const avatarUrl = resolveMediaUrl(r.media);
      const avatar: ImageRef | null = r.media
        ? {
            mediaId: r.media.id,
            url: avatarUrl ?? "",
            alt: r.testimonial.authorName,
            width: r.media.width,
            height: r.media.height,
            blurHash: r.media.blurHash,
          }
        : null;

      return {
        id: r.testimonial.id,
        quote: r.testimonial.quote,
        authorName: r.testimonial.authorName,
        authorTitle: r.testimonial.authorTitle,
        company: r.testimonial.company,
        avatar,
        context: r.testimonial.context,
        productSlug: r.productSlug ?? null,
      };
    });
  }

  async listClientLogos(ctx: Context, tx?: DbOrTx): Promise<ClientLogoView[]> {
    const client = await this.getDatabase(tx);

    const rows = await client
      .select({
        logo: clientLogos,
        media: media,
      })
      .from(clientLogos)
      .innerJoin(media, eq(clientLogos.mediaId, media.id))
      .where(eq(clientLogos.published, true))
      .orderBy(asc(clientLogos.position));

    return rows.map((r: (typeof rows)[number]) => {
      const logoUrl = resolveMediaUrl(r.media);
      return {
        id: r.logo.id,
        name: r.logo.name,
        logo: {
          mediaId: r.media.id,
          url: logoUrl ?? "",
          alt: r.logo.name,
          width: r.media.width,
          height: r.media.height,
          blurHash: r.media.blurHash,
        },
        url: r.logo.url,
      };
    });
  }

  async listFaqs(
    ctx: Context,
    input: z.infer<typeof listFaqsSchema>,
    tx?: DbOrTx,
  ): Promise<FaqView[]> {
    const client = await this.getDatabase(tx);

    const query = client
      .select({
        faq: faqs,
        productSlug: products.slug,
      })
      .from(faqs)
      .leftJoin(products, eq(faqs.productId, products.id))
      .where(
        and(
          eq(faqs.published, true),
          eq(faqs.scope, input.scope),
          input.productSlug ? eq(products.slug, input.productSlug) : sql`true`,
        ),
      )
      .orderBy(asc(faqs.position));

    const rows = await query;

    return rows.map((r: (typeof rows)[number]) => ({
      id: r.faq.id,
      question: r.faq.question,
      answer: r.faq.answerJson,
      html: renderToHtml(r.faq.answerJson as unknown as RichTextDoc),
      scope: r.faq.scope,
      productSlug: r.productSlug ?? null,
    }));
  }

  async getLegalPage(
    ctx: Context,
    input: z.infer<typeof getLegalPageSchema>,
    tx?: DbOrTx,
  ): Promise<LegalPageView> {
    const client = await this.getDatabase(tx);

    const [page] = await client
      .select()
      .from(legalPages)
      .where(eq(legalPages.key, input.key))
      .limit(1);

    if (!page) {
      throw new AppError(ErrorCode.NOT_FOUND, `Legal page '${input.key}' not found`);
    }

    return {
      key: page.key,
      title: page.title,
      html: renderToHtml(page.bodyJson as unknown as RichTextDoc),
      version: page.version,
      publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
    };
  }
}

export function createContentService(getDb?: () => DbOrTx): ContentService {
  return new DefaultContentService(getDb);
}

export const contentService = new DefaultContentService();

/** Preserved for freeze and contract tests (PHASE-02 P2.8). */
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
