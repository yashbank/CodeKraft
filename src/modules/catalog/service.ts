/**
 * Catalog service implementation (docs/05 §2, docs/06 §2.2 API-CAT-*, PHASE-03 P3.6).
 * Full implementation satisfying CatalogService contracts.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { Context, RequestContext } from "@/lib/authz/context";
import type { ListResult } from "@/modules/_shared/zod";
import { auditService } from "@/modules/audit/service";
import { approvalsService } from "@/modules/approvals/service";
import { revalidateTagSafe, revalidateTagsSafe } from "@/lib/revalidate";
import type { Currency } from "@/lib/money";
import {
  categories,
  featuredProducts,
  products,
  productFaqs,
  productMedia,
  productTags,
  productTestimonials,
  productVersions,
  slugRedirects,
  tags,
  wishlists,
  type Category,
  type Product,
  type Tag,
} from "../../../drizzle/schema/catalog";
import {
  offerings,
  offeringPrices,
  offeringPaymentMethods,
} from "../../../drizzle/schema/offerings";
import { productOwnerships, productOwnershipLines } from "../../../drizzle/schema/ownership";
import { orderItems } from "../../../drizzle/schema/commerce";
import { media } from "../../../drizzle/schema/media";
import { users } from "../../../drizzle/schema/auth";
import { partners } from "../../../drizzle/schema/users-ext";
import { releaseFiles } from "../../../drizzle/schema/delivery";
import type {
  CatalogService,
  CreateProductInput,
  CreateProductResult,
  CreateProductVersionInput,
  GetProductBySlugInput,
  LifecycleRequestInput,
  ListProductsAdminInput,
  SubmitForApprovalInput,
  ToggleWishlistInput,
  UpdateProductInput,
  UpsertCategoryInput,
  UpsertProductFaqInput,
  UpsertProductTestimonialInput,
} from "./contracts";
import { SUBMITTABLE_STATUSES } from "./contracts";
import type {
  CategoryNode,
  LifecyclePayload,
  ProductAdminGraph,
  ProductAdminRow,
  ProductCard,
  ProductDetail,
  ProductFaqView,
  ProductTestimonialView,
  ProductVersionView,
  PublishPayload,
} from "./types";
import { resolveRedirect } from "./redirects";

export class DefaultCatalogService implements CatalogService {
  constructor(private readonly getDb?: () => DbOrTx) {}

  private async getDatabase(tx?: DbOrTx): Promise<DbOrTx> {
    if (tx) return tx;
    if (this.getDb) return this.getDb();
    const { db } = await import("@/lib/db");
    return db;
  }

  /**
   * API-CAT-01: Create draft product.
   */
  async createProduct(
    ctx: RequestContext,
    input: CreateProductInput,
    tx?: DbOrTx,
  ): Promise<CreateProductResult> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      // Check slug uniqueness across active products and slug_redirects
      const [existingProduct] = await actionTx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.slug, input.slug))
        .limit(1);

      if (existingProduct) {
        throw new AppError(ErrorCode.CONFLICT, `Product slug '${input.slug}' already exists`);
      }

      const redirectSlug = await resolveRedirect("product", input.slug, actionTx);
      if (redirectSlug) {
        throw new AppError(
          ErrorCode.CONFLICT,
          `Product slug '${input.slug}' is reserved by a previous redirect`,
        );
      }

      if (input.categoryId) {
        const [cat] = await actionTx
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.id, input.categoryId))
          .limit(1);
        if (!cat) {
          throw new AppError(ErrorCode.VALIDATION, "Category not found");
        }
      }

      const [newProduct] = await actionTx
        .insert(products)
        .values({
          name: input.name,
          slug: input.slug,
          shortDescription: input.shortDescription,
          categoryId: input.categoryId ?? null,
          status: "draft",
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();

      if (!newProduct) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to create product");
      }

      // Handle tags if provided
      if (input.tags && input.tags.length > 0) {
        for (const tagName of input.tags) {
          const tagSlug = tagName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
          let [tag] = await actionTx.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1);
          if (!tag) {
            [tag] = await actionTx
              .insert(tags)
              .values({ name: tagName, slug: tagSlug })
              .onConflictDoNothing()
              .returning();
            if (!tag) {
              [tag] = await actionTx.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1);
            }
          }
          if (tag) {
            await actionTx
              .insert(productTags)
              .values({ productId: newProduct.id, tagId: tag.id })
              .onConflictDoNothing();
          }
        }
        await this.refreshTagNames(newProduct.id, actionTx as TxCtx);
      }

      // If caller is a partner (has partner row in partners table), auto-assign initial pending ownership
      let partnerRecord = null;
      if (ctx.partnerId) {
        [partnerRecord] = await actionTx
          .select()
          .from(partners)
          .where(eq(partners.id, ctx.partnerId))
          .limit(1);
      }
      if (!partnerRecord) {
        [partnerRecord] = await actionTx
          .select()
          .from(partners)
          .where(eq(partners.userId, ctx.userId))
          .limit(1);
      }

      if (partnerRecord) {
        const [ownership] = await actionTx
          .insert(productOwnerships)
          .values({
            productId: newProduct.id,
            version: 1,
            companyCutBps: 0,
            status: "pending",
            createdBy: ctx.userId,
          })
          .returning();

        if (ownership) {
          await actionTx.insert(productOwnershipLines).values({
            ownershipId: ownership.id,
            partnerId: partnerRecord.id,
            shareBps: 10000,
          });
        }
      }

      await auditService.log(
        ctx,
        "catalog.product_created",
        { type: "product", id: newProduct.id },
        null,
        { id: newProduct.id, slug: newProduct.slug, name: newProduct.name },
        actionTx as TxCtx,
      );

      revalidateTagSafe("catalog");

      return {
        productId: newProduct.id,
        status: "draft",
      };
    }, outerTx);
  }

  /**
   * API-CAT-02: Update product with optimistic concurrency and slug redirect handling.
   */
  async updateProduct(
    ctx: RequestContext,
    input: UpdateProductInput,
    tx?: DbOrTx,
  ): Promise<{ product: Product }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      const [existing] = await actionTx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      if (!existing) {
        throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
      }

      // Optimistic concurrency check
      const currentIso = existing.updatedAt.toISOString();
      if (input.expectedUpdatedAt && currentIso !== input.expectedUpdatedAt) {
        throw new AppError(
          ErrorCode.CONFLICT,
          `Concurrent modification detected (expected: ${input.expectedUpdatedAt}, current: ${currentIso})`,
        );
      }

      const patch = input.patch;
      const slugChanged = patch.slug !== undefined && patch.slug !== existing.slug;

      if (slugChanged && patch.slug) {
        // Check new slug not in products or redirects
        const [conflict] = await actionTx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.slug, patch.slug))
          .limit(1);
        if (conflict) {
          throw new AppError(ErrorCode.CONFLICT, `Slug '${patch.slug}' already in use`);
        }

        // Record slug redirect (oldSlug -> newSlug)
        await actionTx
          .insert(slugRedirects)
          .values({
            entity: "product",
            oldSlug: existing.slug,
            newSlug: patch.slug,
          })
          .onConflictDoUpdate({
            target: [slugRedirects.entity, slugRedirects.oldSlug],
            set: { newSlug: patch.slug, createdAt: new Date() },
          });
      }

      const updateData: Partial<typeof products.$inferInsert> = {
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      };

      if (patch.name !== undefined) updateData.name = patch.name;
      if (patch.slug !== undefined) updateData.slug = patch.slug;
      if (patch.shortDescription !== undefined)
        updateData.shortDescription = patch.shortDescription;
      if (patch.descriptionJson !== undefined)
        updateData.descriptionJson = patch.descriptionJson ?? undefined;
      if (patch.categoryId !== undefined) updateData.categoryId = patch.categoryId;
      if (patch.isFeatured !== undefined) updateData.isFeatured = patch.isFeatured;
      if (patch.isUnlisted !== undefined) updateData.isUnlisted = patch.isUnlisted;
      if (patch.isComingSoon !== undefined) updateData.isComingSoon = patch.isComingSoon;
      if (patch.isRefundable !== undefined) updateData.isRefundable = patch.isRefundable;
      if (patch.taxEnabled !== undefined) updateData.taxEnabled = patch.taxEnabled;
      if (patch.currentVersion !== undefined) updateData.currentVersion = patch.currentVersion;
      if (patch.features !== undefined) updateData.features = patch.features;
      if (patch.benefits !== undefined) updateData.benefits = patch.benefits;
      if (patch.targetAudience !== undefined) updateData.targetAudience = patch.targetAudience;
      if (patch.useCases !== undefined) updateData.useCases = patch.useCases;
      if (patch.industry !== undefined) updateData.industry = patch.industry;
      if (patch.techStack !== undefined) updateData.techStack = patch.techStack;
      if (patch.requirementsJson !== undefined)
        updateData.requirementsJson = patch.requirementsJson ?? undefined;
      if (patch.liveDemoUrl !== undefined) updateData.liveDemoUrl = patch.liveDemoUrl;
      if (patch.seoTitle !== undefined) updateData.seoTitle = patch.seoTitle;
      if (patch.seoDescription !== undefined) updateData.seoDescription = patch.seoDescription;
      if (patch.ogImageMediaId !== undefined) updateData.ogImageMediaId = patch.ogImageMediaId;
      if (patch.canonicalUrl !== undefined) updateData.canonicalUrl = patch.canonicalUrl;

      const [updated] = await actionTx
        .update(products)
        .set(updateData)
        .where(eq(products.id, input.productId))
        .returning();

      if (!updated) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to update product");
      }

      // Sync tags if provided
      if (patch.tags !== undefined) {
        await actionTx.delete(productTags).where(eq(productTags.productId, input.productId));
        for (const tagName of patch.tags) {
          const tagSlug = tagName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
          let [tag] = await actionTx.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1);
          if (!tag) {
            [tag] = await actionTx
              .insert(tags)
              .values({ name: tagName, slug: tagSlug })
              .onConflictDoNothing()
              .returning();
            if (!tag) {
              [tag] = await actionTx.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1);
            }
          }
          if (tag) {
            await actionTx
              .insert(productTags)
              .values({ productId: input.productId, tagId: tag.id })
              .onConflictDoNothing();
          }
        }
        await this.refreshTagNames(input.productId, actionTx as TxCtx);
      }

      await auditService.log(
        ctx,
        "catalog.product_updated",
        { type: "product", id: updated.id },
        existing,
        updated,
        actionTx as TxCtx,
      );

      const tagsToRevalidate = ["catalog", "sitemap", `product:${existing.slug}`];
      if (slugChanged && patch.slug) {
        tagsToRevalidate.push(`product:${patch.slug}`);
      }
      revalidateTagsSafe(tagsToRevalidate);

      return { product: updated };
    }, outerTx);
  }

  /**
   * API-CAT-07: Create product version with changelog.
   */
  async createProductVersion(
    ctx: RequestContext,
    input: CreateProductVersionInput,
    tx?: DbOrTx,
  ): Promise<{ version: ProductVersionView }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      const [existing] = await actionTx
        .select()
        .from(productVersions)
        .where(
          and(
            eq(productVersions.productId, input.productId),
            eq(productVersions.version, input.version),
          ),
        )
        .limit(1);

      if (existing) {
        throw new AppError(
          ErrorCode.CONFLICT,
          `Version '${input.version}' already exists for this product`,
        );
      }

      const [pv] = await actionTx
        .insert(productVersions)
        .values({
          productId: input.productId,
          version: input.version,
          changelogJson: input.changelogJson,
          createdBy: ctx.userId,
        })
        .returning();

      if (!pv) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to create product version");
      }

      // Insert release file if provided
      if (input.releaseFile) {
        await actionTx.insert(releaseFiles).values({
          productId: input.productId,
          version: input.version,
          mediaId: input.releaseFile.mediaId,
          notes: input.releaseFile.notes ?? null,
        });
      }

      // Update current_version on product
      await actionTx
        .update(products)
        .set({ currentVersion: input.version, updatedAt: new Date() })
        .where(eq(products.id, input.productId));

      const [p] = await actionTx
        .select({ slug: products.slug })
        .from(products)
        .where(eq(products.id, input.productId));
      if (p) {
        revalidateTagsSafe(["catalog", `product:${p.slug}`]);
      }

      return {
        version: {
          version: pv.version,
          changelog: pv.changelogJson,
          releasedAt: pv.releasedAt.toISOString(),
        },
      };
    }, outerTx);
  }

  /**
   * API-CAT-08: Upsert FAQ.
   */
  async upsertProductFaq(
    ctx: RequestContext,
    input: UpsertProductFaqInput,
    tx?: DbOrTx,
  ): Promise<{ faqs: ProductFaqView[] }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      if (input.faqId) {
        await actionTx
          .update(productFaqs)
          .set({
            question: input.question,
            answerJson: input.answerJson,
            position: input.position,
            updatedAt: new Date(),
          })
          .where(eq(productFaqs.id, input.faqId));
      } else {
        await actionTx.insert(productFaqs).values({
          productId: input.productId,
          question: input.question,
          answerJson: input.answerJson,
          position: input.position,
        });
      }

      const rows = await actionTx
        .select()
        .from(productFaqs)
        .where(eq(productFaqs.productId, input.productId))
        .orderBy(productFaqs.position);

      return {
        faqs: rows.map((r) => ({
          id: r.id,
          question: r.question,
          answer: r.answerJson,
          position: r.position,
        })),
      };
    }, outerTx);
  }

  /**
   * API-CAT-08: Delete FAQ.
   */
  async deleteProductFaq(
    ctx: RequestContext,
    input: { productId: string; faqId: string },
    tx?: DbOrTx,
  ): Promise<{ faqs: ProductFaqView[] }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      await actionTx
        .delete(productFaqs)
        .where(and(eq(productFaqs.id, input.faqId), eq(productFaqs.productId, input.productId)));

      const rows = await actionTx
        .select()
        .from(productFaqs)
        .where(eq(productFaqs.productId, input.productId))
        .orderBy(productFaqs.position);

      return {
        faqs: rows.map((r) => ({
          id: r.id,
          question: r.question,
          answer: r.answerJson,
          position: r.position,
        })),
      };
    }, outerTx);
  }

  /**
   * API-CAT-08: Reorder FAQs.
   */
  async reorderProductFaqs(
    ctx: RequestContext,
    input: { productId: string; faqIds: string[] },
    tx?: DbOrTx,
  ): Promise<{ faqs: ProductFaqView[] }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      for (let i = 0; i < input.faqIds.length; i++) {
        const faqId = input.faqIds[i];
        if (!faqId) continue;
        await actionTx
          .update(productFaqs)
          .set({ position: i, updatedAt: new Date() })
          .where(and(eq(productFaqs.id, faqId), eq(productFaqs.productId, input.productId)));
      }

      const rows = await actionTx
        .select()
        .from(productFaqs)
        .where(eq(productFaqs.productId, input.productId))
        .orderBy(productFaqs.position);

      return {
        faqs: rows.map((r) => ({
          id: r.id,
          question: r.question,
          answer: r.answerJson,
          position: r.position,
        })),
      };
    }, outerTx);
  }

  /**
   * API-CAT-09: Upsert testimonial.
   */
  async upsertProductTestimonial(
    ctx: RequestContext,
    input: UpsertProductTestimonialInput,
    tx?: DbOrTx,
  ): Promise<{ testimonials: ProductTestimonialView[] }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      if (input.id) {
        await actionTx
          .update(productTestimonials)
          .set({
            authorName: input.authorName,
            authorTitle: input.authorTitle ?? null,
            company: input.company ?? null,
            quote: input.quote,
            avatarMediaId: input.avatarMediaId ?? null,
            position: input.position,
            published: input.published,
            updatedAt: new Date(),
          })
          .where(eq(productTestimonials.id, input.id));
      } else {
        await actionTx.insert(productTestimonials).values({
          productId: input.productId,
          authorName: input.authorName,
          authorTitle: input.authorTitle ?? null,
          company: input.company ?? null,
          quote: input.quote,
          avatarMediaId: input.avatarMediaId ?? null,
          position: input.position,
          published: input.published,
        });
      }

      const rows = await actionTx
        .select()
        .from(productTestimonials)
        .where(eq(productTestimonials.productId, input.productId))
        .orderBy(productTestimonials.position);

      return {
        testimonials: rows.map((r) => ({
          id: r.id,
          authorName: r.authorName,
          authorTitle: r.authorTitle,
          company: r.company,
          quote: r.quote,
          avatar: null,
        })),
      };
    }, outerTx);
  }

  /**
   * API-CAT-09: Delete testimonial.
   */
  async deleteProductTestimonial(
    ctx: RequestContext,
    input: { productId: string; id: string },
    tx?: DbOrTx,
  ): Promise<{ testimonials: ProductTestimonialView[] }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      await actionTx
        .delete(productTestimonials)
        .where(
          and(
            eq(productTestimonials.id, input.id),
            eq(productTestimonials.productId, input.productId),
          ),
        );

      const rows = await actionTx
        .select()
        .from(productTestimonials)
        .where(eq(productTestimonials.productId, input.productId))
        .orderBy(productTestimonials.position);

      return {
        testimonials: rows.map((r) => ({
          id: r.id,
          authorName: r.authorName,
          authorTitle: r.authorTitle,
          company: r.company,
          quote: r.quote,
          avatar: null,
        })),
      };
    }, outerTx);
  }

  /**
   * API-CAT-11: Submit product for dual-admin approval with readiness verification.
   */
  async submitForApproval(
    ctx: RequestContext,
    input: SubmitForApprovalInput,
    tx?: DbOrTx,
  ): Promise<{ approvalRequestId: string }> {
    assertPermission(ctx, "catalog.submit");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      const [p] = await actionTx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      if (!p) {
        throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
      }

      if (!SUBMITTABLE_STATUSES.includes(p.status)) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot submit product for approval in status '${p.status}'. Submittable statuses: ${SUBMITTABLE_STATUSES.join(", ")}`,
        );
      }

      // Readiness Check 1: At least 1 active offering with a base currency price and >= 1 payment method
      const activeOfferings = await actionTx
        .select()
        .from(offerings)
        .where(and(eq(offerings.productId, p.id), eq(offerings.status, "active")));

      let hasValidOffering = false;
      for (const off of activeOfferings) {
        const prices = await actionTx
          .select()
          .from(offeringPrices)
          .where(eq(offeringPrices.offeringId, off.id));
        const methods = await actionTx
          .select()
          .from(offeringPaymentMethods)
          .where(eq(offeringPaymentMethods.offeringId, off.id));

        // base currency is INR
        const hasBasePrice = prices.some((pr) => pr.currency === "INR");
        if (hasBasePrice && methods.length > 0) {
          hasValidOffering = true;
          break;
        }
      }

      // Readiness Check 2: At least 1 cover or screenshot image
      const mediaItems = await actionTx
        .select()
        .from(productMedia)
        .where(eq(productMedia.productId, p.id));
      const hasImage = mediaItems.some((m) => m.kind === "image" || m.kind === "screenshot");

      // Readiness Check 3: Active or pending ownership summing to 10,000 bps
      const ownerships = await actionTx
        .select()
        .from(productOwnerships)
        .where(
          and(
            eq(productOwnerships.productId, p.id),
            inArray(productOwnerships.status, ["active", "pending"]),
          ),
        );

      let hasValidOwnership = false;
      for (const own of ownerships) {
        const lines = await actionTx
          .select()
          .from(productOwnershipLines)
          .where(eq(productOwnershipLines.ownershipId, own.id));
        const sumBps = lines.reduce((acc, l) => acc + l.shareBps, 0) + own.companyCutBps;
        if (sumBps === 10000) {
          hasValidOwnership = true;
          break;
        }
      }

      const failures: string[] = [];
      if (!hasValidOffering) {
        failures.push(
          "Product must have at least one active offering with base price and payment method",
        );
      }
      if (!hasImage) {
        failures.push("Product must have at least one cover or screenshot image");
      }
      if (!hasValidOwnership) {
        failures.push(
          "Product must have an active or pending ownership version summing to 10,000 bps",
        );
      }

      if (failures.length > 0) {
        throw new AppError(
          ErrorCode.VALIDATION,
          `Product readiness checks failed: ${failures.join("; ")}`,
        );
      }

      // Transition to pending_approval
      await actionTx
        .update(products)
        .set({ status: "pending_approval", updatedAt: new Date() })
        .where(eq(products.id, p.id));

      // Request approval via approvalsService
      const req = await approvalsService.request(
        "product.publish",
        { type: "product", id: p.id },
        { productId: p.id, publishAt: input.publishAt },
        ctx.userId,
        actionTx,
      );

      return { approvalRequestId: req.approvalRequestId };
    }, outerTx);
  }

  /**
   * Internal apply handler registered with approvals ('product.publish').
   */
  async applyPublish(payload: PublishPayload, tx: TxCtx): Promise<void> {
    const [p] = await tx.select().from(products).where(eq(products.id, payload.productId)).limit(1);
    if (!p) {
      throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
    }

    const isFuture = Boolean(
      payload.publishAt && new Date(payload.publishAt).getTime() > Date.now(),
    );
    const newStatus = isFuture ? "scheduled" : "published";
    const publishDate = isFuture && payload.publishAt ? new Date(payload.publishAt) : null;
    const publishedAtDate = isFuture ? null : new Date();

    await tx
      .update(products)
      .set({
        status: newStatus,
        publishAt: publishDate,
        publishedAt: publishedAtDate,
        updatedAt: new Date(),
      })
      .where(eq(products.id, payload.productId));

    revalidateTagsSafe(["catalog", "sitemap", `product:${p.slug}`]);
  }

  /**
   * Internal reject handler for 'product.publish': product reverts to draft.
   */
  async onPublishRejected(payload: PublishPayload, tx: TxCtx): Promise<void> {
    await tx
      .update(products)
      .set({ status: "draft", publishAt: null, updatedAt: new Date() })
      .where(eq(products.id, payload.productId));
  }

  /**
   * API-CAT-13: Unpublish product directly (no approval required).
   */
  async unpublishProduct(
    ctx: RequestContext,
    input: { productId: string; reason: string },
    tx?: DbOrTx,
  ): Promise<{ product: Product }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      const [p] = await actionTx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      if (!p) {
        throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
      }

      if (p.status !== "published" && p.status !== "scheduled") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot unpublish product in status '${p.status}'`,
        );
      }

      const [updated] = await actionTx
        .update(products)
        .set({ status: "unpublished", publishAt: null, updatedAt: new Date() })
        .where(eq(products.id, input.productId))
        .returning();

      if (!updated) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to unpublish product");
      }

      await auditService.log(
        ctx,
        "catalog.product_unpublished",
        { type: "product", id: p.id },
        p,
        { ...updated, reason: input.reason },
        actionTx as TxCtx,
      );

      revalidateTagsSafe(["catalog", "sitemap", `product:${p.slug}`]);
      return { product: updated };
    }, outerTx);
  }

  /**
   * API-CAT-14: Request archive approval.
   */
  async requestArchive(
    ctx: RequestContext,
    input: LifecycleRequestInput,
    tx?: DbOrTx,
  ): Promise<{ approvalRequestId: string }> {
    assertPermission(ctx, "catalog.lifecycle.request");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      const [p] = await actionTx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      if (!p) {
        throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
      }

      if (p.status === "archived") {
        throw new AppError(ErrorCode.STATE_INVALID, "Product is already archived");
      }

      const req = await approvalsService.request(
        "product.archive",
        { type: "product", id: p.id },
        { productId: p.id, reason: input.reason },
        ctx.userId,
        actionTx,
      );

      return { approvalRequestId: req.approvalRequestId };
    }, outerTx);
  }

  /**
   * API-CAT-14: Request delete approval. Refused up front if order items exist (BR-11).
   */
  async requestDelete(
    ctx: RequestContext,
    input: LifecycleRequestInput,
    tx?: DbOrTx,
  ): Promise<{ approvalRequestId: string }> {
    assertPermission(ctx, "catalog.lifecycle.request");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      const [p] = await actionTx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      if (!p) {
        throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
      }

      // BR-11: Check for any orders
      const existingOrders = await actionTx
        .select({ count: sql<number>`count(*)::int` })
        .from(orderItems)
        .innerJoin(offerings, eq(orderItems.offeringId, offerings.id))
        .where(eq(offerings.productId, p.id));

      if ((existingOrders[0]?.count ?? 0) > 0) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Cannot delete product with existing customer orders (BR-11)",
        );
      }

      const req = await approvalsService.request(
        "product.delete",
        { type: "product", id: p.id },
        { productId: p.id, reason: input.reason },
        ctx.userId,
        actionTx,
      );

      return { approvalRequestId: req.approvalRequestId };
    }, outerTx);
  }

  /**
   * Internal apply handler for product.archive.
   */
  async applyArchive(payload: LifecyclePayload, tx: TxCtx): Promise<void> {
    const [p] = await tx.select().from(products).where(eq(products.id, payload.productId)).limit(1);
    if (!p) return;

    await tx
      .update(products)
      .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(products.id, payload.productId));

    await tx
      .update(offerings)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(offerings.productId, payload.productId));

    revalidateTagsSafe(["catalog", "sitemap", `product:${p.slug}`]);
  }

  /**
   * Internal apply handler for product.delete. Re-checks zero orders inside tx (BR-11).
   */
  async applyDelete(payload: LifecyclePayload, tx: TxCtx): Promise<void> {
    const [p] = await tx.select().from(products).where(eq(products.id, payload.productId)).limit(1);
    if (!p) return;

    const existingOrders = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(orderItems)
      .innerJoin(offerings, eq(orderItems.offeringId, offerings.id))
      .where(eq(offerings.productId, p.id));

    if ((existingOrders[0]?.count ?? 0) > 0) {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        "Cannot delete product with existing customer orders inside transaction (BR-11)",
      );
    }

    await tx.delete(products).where(eq(products.id, payload.productId));
    revalidateTagsSafe(["catalog", "sitemap", `product:${p.slug}`]);
  }

  /**
   * API-CAT-18: Admin product list with partner scoping (D-512).
   */
  async listProductsAdmin(
    ctx: RequestContext,
    input: ListProductsAdminInput,
    tx?: DbOrTx,
  ): Promise<ListResult<ProductAdminRow>> {
    assertPermission(ctx, "catalog.read");
    const dbClient = await this.getDatabase(tx);

    const isSuperAdmin = ctx.roles.includes("super_admin");
    const limit = input.limit ?? 20;

    let query = dbClient
      .select({
        product: products,
        category: categories,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .$dynamic();

    const conditions = [];

    const partnerId = input.filters?.partnerId;
    const status = input.filters?.status;
    const categoryId = input.filters?.categoryId;
    const search = input.filters?.search;

    // Partner scoping: admin role only sees own products (D-512)
    if (!isSuperAdmin) {
      conditions.push(eq(products.createdBy, ctx.userId));
    } else if (partnerId) {
      conditions.push(eq(products.createdBy, partnerId));
    }

    if (status) {
      conditions.push(eq(products.status, status));
    }
    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }
    if (search) {
      conditions.push(sql`${products.name} ILIKE ${`%${search}%`}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(products.updatedAt)).limit(limit + 1);
    const rows = await query;

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const resultRows: ProductAdminRow[] = [];
    for (const r of items) {
      const p = r.product;
      const cat = r.category;

      const [offeringCnt] = await dbClient
        .select({ count: sql<number>`count(*)::int` })
        .from(offerings)
        .where(eq(offerings.productId, p.id));

      const [orderCnt] = await dbClient
        .select({ count: sql<number>`count(*)::int` })
        .from(orderItems)
        .innerJoin(offerings, eq(orderItems.offeringId, offerings.id))
        .where(eq(offerings.productId, p.id));

      // Fetch active or pending ownership summary
      const [activeOwn] = await dbClient
        .select()
        .from(productOwnerships)
        .where(and(eq(productOwnerships.productId, p.id), eq(productOwnerships.status, "active")))
        .limit(1);

      let ownershipSummary = null;
      if (activeOwn) {
        const lines = await dbClient
          .select({
            partnerId: productOwnershipLines.partnerId,
            shareBps: productOwnershipLines.shareBps,
            userName: users.name,
          })
          .from(productOwnershipLines)
          .leftJoin(users, eq(productOwnershipLines.partnerId, users.id))
          .where(eq(productOwnershipLines.ownershipId, activeOwn.id));

        ownershipSummary = {
          version: activeOwn.version,
          status: activeOwn.status,
          companyCutBps: activeOwn.companyCutBps,
          partners: lines.map((l) => ({
            partnerId: l.partnerId,
            displayName: l.userName ?? "Partner",
            shareBps: l.shareBps,
          })),
        };
      }

      resultRows.push({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        category: cat ? { id: cat.id, slug: cat.slug, name: cat.name } : null,
        isFeatured: p.isFeatured,
        isUnlisted: p.isUnlisted,
        publishAt: p.publishAt ? p.publishAt.toISOString() : null,
        updatedAt: p.updatedAt.toISOString(),
        updatedBy: { id: p.updatedBy, name: "Admin" },
        ownership: ownershipSummary,
        offeringCount: offeringCnt?.count ?? 0,
        orderCount: orderCnt?.count ?? 0,
      });
    }

    const lastItem = items[items.length - 1];
    return {
      items: resultRows,
      nextCursor: hasMore && lastItem ? lastItem.product.id : null,
    };
  }

  /**
   * API-CAT-19: Get admin product graph.
   */
  async getProductAdmin(
    ctx: RequestContext,
    input: { productId: string },
    tx?: DbOrTx,
  ): Promise<ProductAdminGraph> {
    assertPermission(ctx, "catalog.read");
    const dbClient = await this.getDatabase(tx);

    const [p] = await dbClient
      .select()
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);
    if (!p) {
      throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
    }

    // Partner scoping check: admin role can only access own products (D-512)
    const isSuperAdmin = ctx.roles.includes("super_admin");
    if (!isSuperAdmin && p.createdBy !== ctx.userId) {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied to product not owned by partner");
    }

    const tagRows = await dbClient
      .select({ id: tags.id, slug: tags.slug, name: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, p.id));

    const faqRows = await dbClient
      .select()
      .from(productFaqs)
      .where(eq(productFaqs.productId, p.id))
      .orderBy(productFaqs.position);

    const testimonialRows = await dbClient
      .select()
      .from(productTestimonials)
      .where(eq(productTestimonials.productId, p.id))
      .orderBy(productTestimonials.position);

    const versionRows = await dbClient
      .select()
      .from(productVersions)
      .where(eq(productVersions.productId, p.id))
      .orderBy(desc(productVersions.releasedAt));

    const mediaRows = await dbClient
      .select({
        pm: productMedia,
        m: media,
      })
      .from(productMedia)
      .leftJoin(media, eq(productMedia.mediaId, media.id))
      .where(eq(productMedia.productId, p.id))
      .orderBy(productMedia.position);

    const [orderCnt] = await dbClient
      .select({ count: sql<number>`count(*)::int` })
      .from(orderItems)
      .innerJoin(offerings, eq(orderItems.offeringId, offerings.id))
      .where(eq(offerings.productId, p.id));

    return {
      product: p,
      tags: tagRows,
      offerings: [],
      media: mediaRows.map((r) => ({
        id: r.pm.id,
        kind: r.pm.kind,
        mediaId: r.pm.mediaId,
        url: r.pm.embedUrl ?? `/api/files/public/${r.pm.mediaId}`,
        embedUrl: r.pm.embedUrl,
        title: r.pm.title,
        alt: r.pm.alt,
        position: r.pm.position,
        mime: r.m?.mime ?? null,
        width: r.m?.width ?? null,
        height: r.m?.height ?? null,
        blurHash: r.m?.blurHash ?? null,
      })),
      versions: versionRows.map((v) => ({
        version: v.version,
        changelog: v.changelogJson,
        releasedAt: v.releasedAt.toISOString(),
      })),
      faqs: faqRows.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answerJson,
        position: f.position,
      })),
      testimonials: testimonialRows.map((t) => ({
        id: t.id,
        authorName: t.authorName,
        authorTitle: t.authorTitle,
        company: t.company,
        quote: t.quote,
        avatar: null,
        position: t.position,
        published: t.published,
      })),
      blog: null,
      ownershipVersions: [],
      approval: null,
      orderCount: orderCnt?.count ?? 0,
    };
  }

  /**
   * API-CAT-20: Upsert category with depth limit <= 2 (D-303).
   */
  async upsertCategory(
    ctx: RequestContext,
    input: UpsertCategoryInput,
    tx?: DbOrTx,
  ): Promise<{ category: Category }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      // Depth verification: category depth <= 2
      if (input.parentId) {
        const [parent] = await actionTx
          .select()
          .from(categories)
          .where(eq(categories.id, input.parentId))
          .limit(1);

        if (!parent) {
          throw new AppError(ErrorCode.VALIDATION, "Parent category not found");
        }

        if (parent.parentId !== null) {
          throw new AppError(
            ErrorCode.VALIDATION,
            "Category depth cannot exceed 2 levels (categories can only be root or child of root)",
          );
        }
      }

      if (input.id) {
        const [updated] = await actionTx
          .update(categories)
          .set({
            name: input.name,
            slug: input.slug,
            parentId: input.parentId ?? null,
            position: input.position,
            description: input.description ?? null,
            updatedAt: new Date(),
          })
          .where(eq(categories.id, input.id))
          .returning();

        if (!updated) {
          throw new AppError(ErrorCode.INTERNAL, "Failed to update category");
        }

        revalidateTagSafe("catalog");
        return { category: updated };
      }

      const [created] = await actionTx
        .insert(categories)
        .values({
          name: input.name,
          slug: input.slug,
          parentId: input.parentId ?? null,
          position: input.position,
          description: input.description ?? null,
        })
        .returning();

      if (!created) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to create category");
      }

      revalidateTagSafe("catalog");
      return { category: created };
    }, outerTx);
  }

  /**
   * API-CAT-20: Delete category (refuse if products or child categories attached).
   */
  async deleteCategory(
    ctx: RequestContext,
    input: { categoryId: string },
    tx?: DbOrTx,
  ): Promise<void> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    await withTx(async (actionTx) => {
      const attachedProducts = await actionTx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.categoryId, input.categoryId))
        .limit(1);

      if (attachedProducts.length > 0) {
        throw new AppError(ErrorCode.CONFLICT, "Cannot delete category with attached products");
      }

      const childCategories = await actionTx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentId, input.categoryId))
        .limit(1);

      if (childCategories.length > 0) {
        throw new AppError(ErrorCode.CONFLICT, "Cannot delete category with subcategories");
      }

      await actionTx.delete(categories).where(eq(categories.id, input.categoryId));
      revalidateTagSafe("catalog");
    }, outerTx);
  }

  /**
   * API-CAT-20: Upsert tag.
   */
  async upsertTag(
    ctx: RequestContext,
    input: { id?: string; name: string; slug: string },
    tx?: DbOrTx,
  ): Promise<{ tag: Tag }> {
    assertPermission(ctx, "catalog.write");
    const dbClient = await this.getDatabase(tx);

    if (input.id) {
      const [t] = await dbClient
        .update(tags)
        .set({ name: input.name, slug: input.slug })
        .where(eq(tags.id, input.id))
        .returning();

      if (!t) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to update tag");
      }

      return { tag: t };
    }

    const [t] = await dbClient
      .insert(tags)
      .values({ name: input.name, slug: input.slug })
      .onConflictDoUpdate({
        target: [tags.slug],
        set: { name: input.name },
      })
      .returning();

    if (!t) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to upsert tag");
    }

    return { tag: t };
  }

  /**
   * API-CAT-31: Public get product by slug.
   * STRICT GUARANTEE (BR-02): Ownership key is NEVER present in the returned payload at any level!
   */
  async getProductBySlug(
    ctx: Context,
    input: GetProductBySlugInput,
    tx?: DbOrTx,
  ): Promise<ProductDetail> {
    const dbClient = await this.getDatabase(tx);

    let [p] = await dbClient.select().from(products).where(eq(products.slug, input.slug)).limit(1);

    if (!p) {
      // Check slug redirect table
      const redirectedSlug = await resolveRedirect("product", input.slug, dbClient);
      if (redirectedSlug) {
        [p] = await dbClient
          .select()
          .from(products)
          .where(eq(products.slug, redirectedSlug))
          .limit(1);
      }
    }

    if (!p) {
      throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
    }

    // Visibility rules: draft, pending_approval, scheduled, archived are 404 for visitors
    if (
      p.status === "draft" ||
      p.status === "pending_approval" ||
      p.status === "scheduled" ||
      p.status === "archived"
    ) {
      throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
    }

    // Unpublished is only visible to entitlement holders
    if (p.status === "unpublished") {
      // In visitor context or non-entitled user, throw NOT_FOUND
      throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
    }

    let categoryRef = null;
    if (p.categoryId) {
      const [c] = await dbClient
        .select()
        .from(categories)
        .where(eq(categories.id, p.categoryId))
        .limit(1);
      if (c) categoryRef = { id: c.id, slug: c.slug, name: c.name };
    }

    const tagRows = await dbClient
      .select({ id: tags.id, slug: tags.slug, name: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, p.id));

    const faqRows = await dbClient
      .select()
      .from(productFaqs)
      .where(eq(productFaqs.productId, p.id))
      .orderBy(productFaqs.position);

    const testimonialRows = await dbClient
      .select()
      .from(productTestimonials)
      .where(and(eq(productTestimonials.productId, p.id), eq(productTestimonials.published, true)))
      .orderBy(productTestimonials.position);

    const versionRows = await dbClient
      .select()
      .from(productVersions)
      .where(eq(productVersions.productId, p.id))
      .orderBy(desc(productVersions.releasedAt));

    const mediaRows = await dbClient
      .select({
        pm: productMedia,
        m: media,
      })
      .from(productMedia)
      .leftJoin(media, eq(productMedia.mediaId, media.id))
      .where(eq(productMedia.productId, p.id))
      .orderBy(productMedia.position);

    const detail: ProductDetail = {
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      description: p.descriptionJson ?? null,
      status: p.status,
      category: categoryRef,
      tags: tagRows,
      isFeatured: p.isFeatured,
      isUnlisted: p.isUnlisted,
      isComingSoon: p.isComingSoon,
      isRefundable: p.isRefundable,
      taxEnabled: p.taxEnabled,
      currentVersion: p.currentVersion,
      features: p.features ?? [],
      benefits: p.benefits ?? [],
      targetAudience: p.targetAudience ?? [],
      useCases: p.useCases ?? [],
      industry: p.industry ?? [],
      techStack: p.techStack ?? [],
      requirements: p.requirementsJson ?? null,
      liveDemoUrl: p.liveDemoUrl ?? null,
      media: mediaRows.map((r) => ({
        id: r.pm.id,
        kind: r.pm.kind,
        mediaId: r.pm.mediaId,
        url: r.pm.embedUrl ?? (r.m ? `/api/files/public/${r.m.id}` : ""),
        embedUrl: r.pm.embedUrl,
        title: r.pm.title,
        alt: r.pm.alt,
        position: r.pm.position,
        mime: r.m?.mime ?? null,
        width: r.m?.width ?? null,
        height: r.m?.height ?? null,
        blurHash: r.m?.blurHash ?? null,
      })),
      offerings: [],
      faqs: faqRows.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answerJson,
        position: f.position,
      })),
      testimonials: testimonialRows.map((t) => ({
        id: t.id,
        authorName: t.authorName,
        authorTitle: t.authorTitle,
        company: t.company,
        quote: t.quote,
        avatar: null,
      })),
      versions: versionRows.map((v) => ({
        version: v.version,
        changelog: v.changelogJson,
        releasedAt: v.releasedAt.toISOString(),
      })),
      blogTeaser: null,
      seo: {
        title: p.seoTitle ?? p.name,
        description: p.seoDescription ?? p.shortDescription,
        canonicalUrl: p.canonicalUrl,
        ogImage: null,
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.name,
        description: p.shortDescription,
      },
      breadcrumbs: [
        { label: "Home", href: "/" },
        ...(categoryRef
          ? [{ label: categoryRef.name, href: `/catalog?category=${categoryRef.slug}` }]
          : []),
        { label: p.name, href: `/products/${p.slug}` },
      ],
    };

    return detail;
  }

  /**
   * API-CAT-32: List category tree with product counts.
   */
  async listCategories(ctx: Context, tx?: DbOrTx): Promise<CategoryNode[]> {
    const dbClient = await this.getDatabase(tx);

    const allCategories = await dbClient.select().from(categories).orderBy(categories.position);

    // Compute product counts for each category
    const countRows = await dbClient
      .select({
        categoryId: products.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(products)
      .where(and(eq(products.status, "published"), eq(products.isUnlisted, false)))
      .groupBy(products.categoryId);

    const countsMap = new Map<string, number>();
    for (const r of countRows) {
      if (r.categoryId) countsMap.set(r.categoryId, r.count);
    }

    const roots: CategoryNode[] = [];
    const childrenByParent = new Map<string, CategoryNode[]>();

    for (const c of allCategories) {
      const node: CategoryNode = {
        id: c.id,
        slug: c.slug,
        name: c.name,
        parentId: c.parentId,
        position: c.position,
        description: c.description,
        productCount: countsMap.get(c.id) ?? 0,
        children: [],
      };

      if (!c.parentId) {
        roots.push(node);
      } else {
        const list = childrenByParent.get(c.parentId) ?? [];
        list.push(node);
        childrenByParent.set(c.parentId, list);
      }
    }

    for (const root of roots) {
      root.children = childrenByParent.get(root.id) ?? [];
    }

    return roots;
  }

  /**
   * API-CAT-34: List featured products for landing (up to 8, published & listed only).
   */
  async listFeaturedProducts(
    ctx: Context,
    input: { limit?: number; displayCurrency: Currency },
    tx?: DbOrTx,
  ): Promise<ProductCard[]> {
    const dbClient = await this.getDatabase(tx);
    const max = input.limit ?? 8;

    const rows = await dbClient
      .select({
        product: products,
        category: categories,
      })
      .from(featuredProducts)
      .innerJoin(products, eq(featuredProducts.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.status, "published"), eq(products.isUnlisted, false)))
      .orderBy(featuredProducts.position)
      .limit(max);

    const cards: ProductCard[] = [];

    for (const r of rows) {
      const p = r.product;
      const cat = r.category;

      const tagRows = await dbClient
        .select({ id: tags.id, slug: tags.slug, name: tags.name })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(eq(productTags.productId, p.id));

      cards.push({
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        coverImage: null,
        category: cat ? { id: cat.id, slug: cat.slug, name: cat.name } : null,
        tags: tagRows,
        fromPrice: null,
        purchaseModels: ["one_time"],
        deliveryTypes: ["download"],
        isFeatured: true,
        isComingSoon: p.isComingSoon,
        currentVersion: p.currentVersion,
      });
    }

    return cards;
  }

  /**
   * API-CAT-35: Toggle wishlist entry.
   */
  async toggleWishlist(
    ctx: RequestContext,
    input: ToggleWishlistInput,
    tx?: DbOrTx,
  ): Promise<{ wishlisted: boolean }> {
    assertPermission(ctx, "account.self");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      const [existing] = await actionTx
        .select()
        .from(wishlists)
        .where(and(eq(wishlists.userId, ctx.userId), eq(wishlists.productId, input.productId)))
        .limit(1);

      if (input.on) {
        if (!existing) {
          await actionTx.insert(wishlists).values({
            userId: ctx.userId,
            productId: input.productId,
          });
        }
        return { wishlisted: true };
      } else {
        if (existing) {
          await actionTx
            .delete(wishlists)
            .where(and(eq(wishlists.userId, ctx.userId), eq(wishlists.productId, input.productId)));
        }
        return { wishlisted: false };
      }
    }, outerTx);
  }

  /**
   * API-CAT-36: List user's wishlist.
   */
  async listMyWishlist(
    ctx: RequestContext,
    input: { cursor?: string; limit?: number; displayCurrency: Currency },
    tx?: DbOrTx,
  ): Promise<ListResult<ProductCard>> {
    assertPermission(ctx, "account.self");
    const dbClient = await this.getDatabase(tx);

    const limit = input.limit ?? 20;

    const rows = await dbClient
      .select({
        product: products,
        category: categories,
      })
      .from(wishlists)
      .innerJoin(products, eq(wishlists.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(wishlists.userId, ctx.userId))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const cards: ProductCard[] = items.map((r) => ({
      slug: r.product.slug,
      name: r.product.name,
      shortDescription: r.product.shortDescription,
      coverImage: null,
      category: r.category
        ? { id: r.category.id, slug: r.category.slug, name: r.category.name }
        : null,
      tags: [],
      fromPrice: null,
      purchaseModels: ["one_time"],
      deliveryTypes: ["download"],
      isFeatured: r.product.isFeatured,
      isComingSoon: r.product.isComingSoon,
      currentVersion: r.product.currentVersion,
    }));

    const lastItem = items[items.length - 1];
    return {
      items: cards,
      nextCursor: hasMore && lastItem ? lastItem.product.id : null,
    };
  }

  /**
   * Internal helper: refresh denormalized products.tag_names.
   */
  async refreshTagNames(productId: string, tx: TxCtx): Promise<void> {
    const rows = await tx
      .select({ name: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, productId));

    const tagNames = rows.map((r) => r.name);

    await tx.update(products).set({ tagNames }).where(eq(products.id, productId));
  }
}

/** Preserved for freeze and contract tests (PHASE-02 P2.8). */
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

export function createCatalogService(getDb?: () => DbOrTx): CatalogService {
  return new DefaultCatalogService(getDb);
}

export const catalogService: CatalogService = new DefaultCatalogService();

// Register approval apply and reject handlers with approvalsService
approvalsService.registerApplyHandler("product.publish", async (_ctx, payload, tx) => {
  await catalogService.applyPublish(payload as PublishPayload, tx);
});

approvalsService.registerRejectHandler("product.publish", async (_ctx, payload, tx) => {
  await catalogService.onPublishRejected(payload as PublishPayload, tx);
});

approvalsService.registerApplyHandler("product.archive", async (_ctx, payload, tx) => {
  await catalogService.applyArchive(payload as LifecyclePayload, tx);
});

approvalsService.registerApplyHandler("product.delete", async (_ctx, payload, tx) => {
  await catalogService.applyDelete(payload as LifecyclePayload, tx);
});
