/**
 * Blog service implementation (docs/06 API-CAT-10, API-CAT-33, API-CAT-34; PHASE-03 P3.10).
 * Implements BlogService with:
 * - One blog post per product (D-121, D-804)
 * - Slug redirect tracking on slug changes
 * - Publish gated on published product (FR-CONT-05, API-CAT-10)
 * - Rendered HTML from Tiptap JSON via renderToHtml (ADR-10, TM-21, SA-19)
 * - JSON-LD Article structured data (FR-SEO-02)
 * - Cache invalidation via revalidateTagsSafe
 */
import { and, asc, count, desc, eq, or, sql } from "drizzle-orm";
import type { Context, RequestContext } from "@/lib/authz/context";
import { assertPermission } from "@/lib/authz/assert";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { revalidateTagsSafe } from "@/lib/revalidate";
import { getPublicMediaBaseUrl } from "@/lib/storage";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { Currency, ListResult, RichTextDoc } from "@/modules/_shared/zod";
import {
  categories,
  media,
  offeringPrices,
  offerings,
  productBlogs,
  productMedia,
  products,
  productTags,
  slugRedirects,
  tags,
  users,
} from "../../../drizzle/schema";
import { renderToHtml } from "../content/render";
import type {
  BlogService,
  ListBlogPostsInput,
  UpsertProductBlogInput,
  blogPublishSchema,
  getBlogBySlugSchema,
  listBlogTeasersSchema,
} from "./contracts";
import type { BlogCard, BlogDetail, ProductBlog } from "./types";
import type { Money } from "@/lib/money";
import type { ImageRef, ProductCard } from "../catalog/types";
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

export class DefaultBlogService implements BlogService {
  constructor(private readonly getDb?: () => DbOrTx) {}

  private async getDatabase(tx?: DbOrTx): Promise<DbOrTx> {
    if (tx) return tx;
    if (this.getDb) return this.getDb();
    const { db } = await import("@/lib/db");
    return db;
  }

  /**
   * API-CAT-10: Upsert product blog post (one post per product).
   * A slug change on an existing published blog writes to `slug_redirects(entity='blog')`.
   */
  async upsertProductBlog(
    ctx: RequestContext,
    input: UpsertProductBlogInput,
    tx?: DbOrTx,
  ): Promise<{ blog: ProductBlog }> {
    assertPermission(ctx, "catalog.write");
    const client = await this.getDatabase(tx);

    // 1. Verify product exists
    const [product] = await client
      .select({ id: products.id, slug: products.slug })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    if (!product) {
      throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
    }

    // 2. Check if a blog already exists for this product
    const [existingBlog] = await client
      .select()
      .from(productBlogs)
      .where(eq(productBlogs.productId, input.productId))
      .limit(1);

    // 3. Check if the proposed slug is already taken by another blog
    const [existingSlug] = await client
      .select({ id: productBlogs.id, productId: productBlogs.productId })
      .from(productBlogs)
      .where(eq(productBlogs.slug, input.slug))
      .limit(1);

    if (existingSlug && (!existingBlog || existingSlug.id !== existingBlog.id)) {
      throw new AppError(ErrorCode.CONFLICT, `Blog slug '${input.slug}' already in use`);
    }

    let resultBlog: ProductBlog;

    if (existingBlog) {
      // Slug change on published blog records 301 redirect
      if (existingBlog.slug !== input.slug && existingBlog.status === "published") {
        await client
          .insert(slugRedirects)
          .values({
            entity: "blog",
            oldSlug: existingBlog.slug,
            newSlug: input.slug,
          })
          .onConflictDoUpdate({
            target: [slugRedirects.entity, slugRedirects.oldSlug],
            set: { newSlug: input.slug, createdAt: new Date() },
          });
      }

      const [updated] = await client
        .update(productBlogs)
        .set({
          slug: input.slug,
          title: input.title,
          excerpt: input.excerpt,
          bodyJson: input.bodyJson,
          coverMediaId: input.coverMediaId ?? null,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          updatedAt: new Date(),
        })
        .where(eq(productBlogs.id, existingBlog.id))
        .returning();

      if (!updated) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to update blog post");
      }

      resultBlog = updated;
    } else {
      const [inserted] = await client
        .insert(productBlogs)
        .values({
          productId: input.productId,
          slug: input.slug,
          title: input.title,
          excerpt: input.excerpt,
          bodyJson: input.bodyJson,
          coverMediaId: input.coverMediaId ?? null,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          authorId: ctx.userId,
          status: "draft",
        })
        .returning();

      if (!inserted) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to create blog post");
      }

      resultBlog = inserted;
    }

    revalidateTagsSafe(["blog", `blog:${resultBlog.slug}`, `product:${product.slug}`, "sitemap"]);
    if (existingBlog && existingBlog.slug !== resultBlog.slug) {
      revalidateTagsSafe([`blog:${existingBlog.slug}`]);
    }

    return { blog: resultBlog };
  }

  /**
   * API-CAT-10: Publish product blog post.
   * Product must be in `published` status (FR-CONT-05, API-CAT-10).
   */
  async publishProductBlog(
    ctx: RequestContext,
    input: z.infer<typeof blogPublishSchema>,
    tx?: DbOrTx,
  ): Promise<{ blog: ProductBlog }> {
    assertPermission(ctx, "content.publish");
    const client = await this.getDatabase(tx);

    const [product] = await client
      .select({ id: products.id, slug: products.slug, status: products.status })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    if (!product) {
      throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
    }

    if (product.status !== "published") {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        "Product must be published before publishing its blog post",
      );
    }

    const [blog] = await client
      .select()
      .from(productBlogs)
      .where(eq(productBlogs.productId, input.productId))
      .limit(1);

    if (!blog) {
      throw new AppError(ErrorCode.NOT_FOUND, "Blog not found for product");
    }

    const [updated] = await client
      .update(productBlogs)
      .set({
        status: "published",
        publishedAt: blog.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(productBlogs.id, blog.id))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to publish blog post");
    }

    revalidateTagsSafe(["blog", `blog:${updated.slug}`, `product:${product.slug}`, "sitemap"]);
    return { blog: updated };
  }

  /**
   * API-CAT-10: Unpublish product blog post (reverts status to `draft`).
   */
  async unpublishProductBlog(
    ctx: RequestContext,
    input: z.infer<typeof blogPublishSchema>,
    tx?: DbOrTx,
  ): Promise<{ blog: ProductBlog }> {
    assertPermission(ctx, "content.publish");
    const client = await this.getDatabase(tx);

    const [product] = await client
      .select({ id: products.id, slug: products.slug })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    const [blog] = await client
      .select()
      .from(productBlogs)
      .where(eq(productBlogs.productId, input.productId))
      .limit(1);

    if (!blog) {
      throw new AppError(ErrorCode.NOT_FOUND, "Blog not found for product");
    }

    const [updated] = await client
      .update(productBlogs)
      .set({
        status: "draft",
        updatedAt: new Date(),
      })
      .where(eq(productBlogs.id, blog.id))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to unpublish blog post");
    }

    const tagsToReval: string[] = ["blog", `blog:${updated.slug}`, "sitemap"];
    if (product) {
      tagsToReval.push(`product:${product.slug}`);
    }
    revalidateTagsSafe(tagsToReval);
    return { blog: updated };
  }

  /**
   * API-CAT-33: Public list of published blog posts.
   */
  async listBlogPosts(
    ctx: Context,
    input: ListBlogPostsInput,
    tx?: DbOrTx,
  ): Promise<ListResult<BlogCard>> {
    const client = await this.getDatabase(tx);
    const limit = input.limit ?? 25;
    const isAsc = input.sort?.endsWith(":asc") ?? false;

    const conditions = [eq(productBlogs.status, "published")];

    if (input.filters?.productSlug) {
      conditions.push(eq(products.slug, input.filters.productSlug));
    }

    if (input.cursor) {
      const decoded = decodeCursor(input.cursor);
      if (decoded) {
        const cursorCond = isAsc
          ? or(
              sql`extract(epoch from ${productBlogs.publishedAt}) * 1000 > ${decoded.epochMs}`,
              and(
                sql`floor(extract(epoch from ${productBlogs.publishedAt}) * 1000) = ${decoded.epochMs}`,
                sql`${productBlogs.id} > ${decoded.id}::uuid`,
              ),
            )
          : or(
              sql`extract(epoch from ${productBlogs.publishedAt}) * 1000 < ${decoded.epochMs}`,
              and(
                sql`floor(extract(epoch from ${productBlogs.publishedAt}) * 1000) = ${decoded.epochMs}`,
                sql`${productBlogs.id} < ${decoded.id}::uuid`,
              ),
            );
        if (cursorCond) {
          conditions.push(cursorCond);
        }
      }
    }

    const orderCols = isAsc
      ? [asc(productBlogs.publishedAt), asc(productBlogs.id)]
      : [desc(productBlogs.publishedAt), desc(productBlogs.id)];

    const rows = await client
      .select({
        blog: productBlogs,
        product: {
          slug: products.slug,
          name: products.name,
        },
        author: {
          name: users.name,
        },
        media: media,
      })
      .from(productBlogs)
      .innerJoin(products, eq(productBlogs.productId, products.id))
      .innerJoin(users, eq(productBlogs.authorId, users.id))
      .leftJoin(media, eq(productBlogs.coverMediaId, media.id))
      .where(and(...conditions))
      .orderBy(...orderCols)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const itemsRows = hasMore ? rows.slice(0, limit) : rows;

    const [totalRow] = await client
      .select({ total: count() })
      .from(productBlogs)
      .innerJoin(products, eq(productBlogs.productId, products.id))
      .where(
        input.filters?.productSlug
          ? and(eq(productBlogs.status, "published"), eq(products.slug, input.filters.productSlug))
          : eq(productBlogs.status, "published"),
      );

    const items: BlogCard[] = itemsRows.map((r: (typeof rows)[number]) => {
      const coverUrl = resolveMediaUrl(r.media);
      const coverRef: ImageRef | null = r.media
        ? {
            mediaId: r.media.id,
            url: coverUrl ?? "",
            alt: r.blog.title,
            width: r.media.width,
            height: r.media.height,
            blurHash: r.media.blurHash,
          }
        : null;

      return {
        slug: r.blog.slug,
        title: r.blog.title,
        excerpt: r.blog.excerpt,
        cover: coverRef,
        publishedAt: r.blog.publishedAt
          ? new Date(r.blog.publishedAt).toISOString()
          : new Date().toISOString(),
        product: r.product,
        author: { name: r.author.name ?? "CodeKraft" },
      };
    });

    const lastItem = itemsRows[itemsRows.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.blog.publishedAt
        ? encodeCursor(new Date(lastItem.blog.publishedAt), lastItem.blog.id)
        : null;

    return {
      items,
      nextCursor,
      total: totalRow?.total ?? items.length,
    };
  }

  /**
   * API-CAT-33: Public get blog post by slug.
   * Handles slug redirects, renders HTML from Tiptap AST, produces JSON-LD Article.
   */
  async getBlogBySlug(
    ctx: Context,
    input: z.infer<typeof getBlogBySlugSchema>,
    tx?: DbOrTx,
  ): Promise<BlogDetail> {
    const client = await this.getDatabase(tx);

    let [row] = await client
      .select({
        blog: productBlogs,
        product: products,
        author: users,
        media: media,
      })
      .from(productBlogs)
      .innerJoin(products, eq(productBlogs.productId, products.id))
      .innerJoin(users, eq(productBlogs.authorId, users.id))
      .leftJoin(media, eq(productBlogs.coverMediaId, media.id))
      .where(eq(productBlogs.slug, input.slug))
      .limit(1);

    if (!row) {
      // Check slug_redirects
      const [redirect] = await client
        .select()
        .from(slugRedirects)
        .where(and(eq(slugRedirects.entity, "blog"), eq(slugRedirects.oldSlug, input.slug)))
        .limit(1);

      if (redirect) {
        [row] = await client
          .select({
            blog: productBlogs,
            product: products,
            author: users,
            media: media,
          })
          .from(productBlogs)
          .innerJoin(products, eq(productBlogs.productId, products.id))
          .innerJoin(users, eq(productBlogs.authorId, users.id))
          .leftJoin(media, eq(productBlogs.coverMediaId, media.id))
          .where(eq(productBlogs.slug, redirect.newSlug))
          .limit(1);
      }
    }

    if (!row || row.blog.status !== "published") {
      throw new AppError(ErrorCode.NOT_FOUND, "Blog post not found");
    }

    // Resolve ProductCard
    const [cat] = row.product.categoryId
      ? await client
          .select({ id: categories.id, slug: categories.slug, name: categories.name })
          .from(categories)
          .where(eq(categories.id, row.product.categoryId))
          .limit(1)
      : [null];

    const tagRows = await client
      .select({ id: tags.id, slug: tags.slug, name: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, row.product.id));

    // Cover image of product
    const [prodMediaRow] = await client
      .select({ media: media, alt: productMedia.alt })
      .from(productMedia)
      .innerJoin(media, eq(productMedia.mediaId, media.id))
      .where(and(eq(productMedia.productId, row.product.id), eq(productMedia.kind, "image")))
      .orderBy(asc(productMedia.position))
      .limit(1);

    const prodCoverUrl = resolveMediaUrl(prodMediaRow?.media ?? null);
    const prodCover: ImageRef | null = prodMediaRow?.media
      ? {
          mediaId: prodMediaRow.media.id,
          url: prodCoverUrl ?? "",
          alt: prodMediaRow.alt || row.product.name,
          width: prodMediaRow.media.width,
          height: prodMediaRow.media.height,
          blurHash: prodMediaRow.media.blurHash,
        }
      : null;

    // Minimum offering price in displayCurrency or fallback to INR
    let fromPrice: Money | null = null;
    const [displayPrice] = await client
      .select({ amountMinor: offeringPrices.amountMinor })
      .from(offeringPrices)
      .innerJoin(offerings, eq(offeringPrices.offeringId, offerings.id))
      .where(
        and(
          eq(offerings.productId, row.product.id),
          eq(offerings.status, "active"),
          eq(offeringPrices.currency, input.displayCurrency),
        ),
      )
      .orderBy(asc(offeringPrices.amountMinor))
      .limit(1);

    if (displayPrice) {
      fromPrice = {
        amountMinor: displayPrice.amountMinor,
        currency: input.displayCurrency as Currency,
      };
    } else {
      const [basePrice] = await client
        .select({ amountMinor: offeringPrices.amountMinor })
        .from(offeringPrices)
        .innerJoin(offerings, eq(offeringPrices.offeringId, offerings.id))
        .where(
          and(
            eq(offerings.productId, row.product.id),
            eq(offerings.status, "active"),
            eq(offeringPrices.currency, "INR"),
          ),
        )
        .orderBy(asc(offeringPrices.amountMinor))
        .limit(1);

      if (basePrice) {
        fromPrice = { amountMinor: basePrice.amountMinor, currency: "INR" };
      }
    }

    const productCard: ProductCard = {
      slug: row.product.slug,
      name: row.product.name,
      shortDescription: row.product.shortDescription,
      coverImage: prodCover,
      category: cat ? { id: cat.id, slug: cat.slug, name: cat.name } : null,
      tags: tagRows,
      fromPrice,
      purchaseModels: ["one_time"],
      deliveryTypes: ["download"],
      isFeatured: row.product.isFeatured ?? false,
      isComingSoon: row.product.isComingSoon ?? false,
      currentVersion: row.product.currentVersion,
    };

    // Render HTML
    const html = renderToHtml(row.blog.bodyJson as unknown as RichTextDoc);

    // Blog cover
    const blogCoverUrl = resolveMediaUrl(row.media);
    const blogCover: ImageRef | null = row.media
      ? {
          mediaId: row.media.id,
          url: blogCoverUrl ?? "",
          alt: row.blog.title,
          width: row.media.width,
          height: row.media.height,
          blurHash: row.media.blurHash,
        }
      : null;

    // JSON-LD Article
    const domain = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
      : "codekraft.dev";

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `https://${domain}/blog/${row.blog.slug}#article`,
      headline: row.blog.title,
      description: row.blog.excerpt ?? row.blog.seoDescription ?? "",
      image: blogCoverUrl ? [blogCoverUrl] : [],
      datePublished: row.blog.publishedAt
        ? new Date(row.blog.publishedAt).toISOString()
        : new Date().toISOString(),
      dateModified: new Date(row.blog.updatedAt).toISOString(),
      author: { "@id": `https://${domain}/#organization` },
      publisher: { "@id": `https://${domain}/#organization` },
      mainEntityOfPage: `https://${domain}/blog/${row.blog.slug}`,
      about: { "@id": `https://${domain}/products/${row.product.slug}#product` },
      isPartOf: { "@id": `https://${domain}/#website` },
      inLanguage: "en",
    };

    return {
      blog: {
        slug: row.blog.slug,
        title: row.blog.title,
        excerpt: row.blog.excerpt,
        cover: blogCover,
        publishedAt: row.blog.publishedAt
          ? new Date(row.blog.publishedAt).toISOString()
          : new Date().toISOString(),
        seoTitle: row.blog.seoTitle,
        seoDescription: row.blog.seoDescription,
        author: { name: row.author.name ?? "CodeKraft" },
      },
      product: productCard,
      html,
      jsonLd,
    };
  }

  /**
   * API-CAT-34: Teaser list for landing page.
   */
  async listBlogTeasers(
    ctx: Context,
    input: z.infer<typeof listBlogTeasersSchema>,
    tx?: DbOrTx,
  ): Promise<BlogCard[]> {
    const client = await this.getDatabase(tx);
    const limit = input.limit ?? 3;

    const rows = await client
      .select({
        blog: productBlogs,
        product: {
          slug: products.slug,
          name: products.name,
        },
        author: {
          name: users.name,
        },
        media: media,
      })
      .from(productBlogs)
      .innerJoin(products, eq(productBlogs.productId, products.id))
      .innerJoin(users, eq(productBlogs.authorId, users.id))
      .leftJoin(media, eq(productBlogs.coverMediaId, media.id))
      .where(eq(productBlogs.status, "published"))
      .orderBy(desc(productBlogs.publishedAt), desc(productBlogs.id))
      .limit(limit);

    return rows.map((r: (typeof rows)[number]) => {
      const coverUrl = resolveMediaUrl(r.media);
      const coverRef: ImageRef | null = r.media
        ? {
            mediaId: r.media.id,
            url: coverUrl ?? "",
            alt: r.blog.title,
            width: r.media.width,
            height: r.media.height,
            blurHash: r.media.blurHash,
          }
        : null;

      return {
        slug: r.blog.slug,
        title: r.blog.title,
        excerpt: r.blog.excerpt,
        cover: coverRef,
        publishedAt: r.blog.publishedAt
          ? new Date(r.blog.publishedAt).toISOString()
          : new Date().toISOString(),
        product: r.product,
        author: { name: r.author.name ?? "CodeKraft" },
      };
    });
  }
}

export function createBlogService(getDb?: () => DbOrTx): BlogService {
  return new DefaultBlogService(getDb);
}

export const blogService = new DefaultBlogService();

/** Preserved for freeze and contract tests (PHASE-02 P2.8). */
export function createNotImplementedBlogService(): BlogService {
  return createNotImplemented<BlogService>("blog", "P3", {
    upsertProductBlog: "async",
    publishProductBlog: "async",
    unpublishProductBlog: "async",
    listBlogPosts: "async",
    getBlogBySlug: "async",
    listBlogTeasers: "async",
  });
}
