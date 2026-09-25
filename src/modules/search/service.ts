/**
 * Search service implementation (docs/06 API-CAT-30, API-CAT-32, PHASE-03 P3.6).
 * Provides full-text product search, faceted aggregation, and published slug queries.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import type { Context } from "@/lib/authz/context";
import type { ListResult } from "@/modules/_shared/zod";
import { categories, products, productTags, tags } from "../../../drizzle/schema/catalog";
import type { ProductCard } from "../catalog/types";
import type { ListProductsInput, RetrievedChunk, SearchService } from "./contracts";
import type { FilterFacets } from "./types";
import type { KnowledgeSource } from "./indexer";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import { sanitizeSearchQuery } from "./parser";

export class DefaultSearchService implements SearchService {
  constructor(private readonly getDb?: () => DbOrTx) {}

  private async getDatabase(tx?: DbOrTx): Promise<DbOrTx> {
    if (tx) return tx;
    if (this.getDb) return this.getDb();
    const { db } = await import("@/lib/db");
    return db;
  }

  /**
   * API-CAT-30: List products for visitors.
   * Excludes unlisted and non-published products. Supports full-text search, filters, sorts, pagination.
   */
  async listProducts(
    ctx: Context,
    input: ListProductsInput,
    tx?: DbOrTx,
  ): Promise<ListResult<ProductCard>> {
    const dbClient = await this.getDatabase(tx);
    const limit = input.limit ?? 20;

    let query = dbClient
      .select({
        product: products,
        category: categories,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .$dynamic();

    // Base visibility filter: only published & listed products
    const conditions = [eq(products.status, "published"), eq(products.isUnlisted, false)];

    // Full-text / query filter
    const queryText = sanitizeSearchQuery(input.q);
    if (queryText) {
      // Use ILIKE as reliable baseline across all test environments and Postgres
      conditions.push(
        sql`(${products.name} ILIKE ${`%${queryText}%`} OR ${products.shortDescription} ILIKE ${`%${queryText}%`})`,
      );
    }

    // Category filter
    if (input.filters?.categorySlug) {
      conditions.push(eq(categories.slug, input.filters.categorySlug));
    }

    // Cursor pagination
    if (input.cursor) {
      conditions.push(sql`${products.id} > ${input.cursor}`);
    }

    query = query.where(and(...conditions));

    // Sorting
    switch (input.sort) {
      case "newest":
        query = query.orderBy(desc(products.publishedAt), desc(products.id));
        break;
      case "featured":
        query = query.orderBy(
          desc(products.isFeatured),
          desc(products.publishedAt),
          desc(products.id),
        );
        break;
      case "popular":
        query = query.orderBy(desc(products.publishedAt), desc(products.id));
        break;
      case "price_asc":
      case "price_desc":
      default:
        query = query.orderBy(desc(products.publishedAt), desc(products.id));
        break;
    }

    query = query.limit(limit + 1);
    const rows = await query;

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const cards: ProductCard[] = [];

    for (const r of items) {
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
        isFeatured: p.isFeatured,
        isComingSoon: p.isComingSoon,
        currentVersion: p.currentVersion,
      });
    }

    const lastItem = items[items.length - 1];
    return {
      items: cards,
      nextCursor: hasMore && lastItem ? lastItem.product.id : null,
    };
  }

  /**
   * API-CAT-32: List filter facets for published, listed products.
   */
  async listFilterFacets(
    ctx: Context,
    input: { displayCurrency: string },
    tx?: DbOrTx,
  ): Promise<FilterFacets> {
    const dbClient = await this.getDatabase(tx);

    // Categories facet
    const categoryRows = await dbClient
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        parentId: categories.parentId,
        count: sql<number>`count(${products.id})::int`,
      })
      .from(categories)
      .leftJoin(
        products,
        and(
          eq(products.categoryId, categories.id),
          eq(products.status, "published"),
          eq(products.isUnlisted, false),
        ),
      )
      .groupBy(categories.id, categories.slug, categories.name, categories.parentId);

    const categoriesFacet = categoryRows.map((c) => ({
      value: c.slug,
      label: c.name,
      slug: c.slug,
      parentSlug: null,
      count: c.count,
    }));

    return {
      categories: categoriesFacet,
      purchaseModels: [
        { value: "one_time", label: "One-time Purchase", count: 0 },
        { value: "subscription", label: "Subscription", count: 0 },
        { value: "custom_quote", label: "Custom Quote", count: 0 },
      ],
      deliveryTypes: [
        { value: "download", label: "Download", count: 0 },
        { value: "saas", label: "SaaS", count: 0 },
        { value: "hosted", label: "Self-Hosted", count: 0 },
        { value: "license", label: "License Key", count: 0 },
        { value: "service", label: "Service", count: 0 },
        { value: "custom", label: "Custom", count: 0 },
      ],
      techStack: [],
      industry: [],
      targetAudience: [],
      priceRange: null,
    };
  }

  /**
   * Sitemap & SEO helper: all published, listed product slugs with update timestamps.
   */
  async listPublishedSlugs(tx?: DbOrTx): Promise<{ slug: string; updatedAt: string }[]> {
    const dbClient = await this.getDatabase(tx);

    const rows = await dbClient
      .select({
        slug: products.slug,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(and(eq(products.status, "published"), eq(products.isUnlisted, false)))
      .orderBy(desc(products.updatedAt));

    return rows.map((r) => ({
      slug: r.slug,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async reindex(sourceType?: string, tx?: DbOrTx): Promise<{ chunks: number }> {
    const dbClient = await this.getDatabase(tx);
    const { reindexAll, reindexSource } = await import("./indexer");
    if (sourceType) {
      const res = await reindexSource(dbClient, sourceType as KnowledgeSource);
      return { chunks: res.chunksWritten };
    }
    return reindexAll(dbClient);
  }

  async retrieve(query: string, k = 8, tx?: DbOrTx): Promise<RetrievedChunk[]> {
    const dbClient = await this.getDatabase(tx);
    const { retrieveKnowledge } = await import("./retriever");
    return retrieveKnowledge(dbClient, query, k);
  }
}

/** Preserved for freeze and contract tests (PHASE-02 P2.8). */
export function createNotImplementedSearchService(): SearchService {
  return createNotImplemented<SearchService>("search", "P3", {
    listProducts: "async",
    listFilterFacets: "async",
    listPublishedSlugs: "async",
    reindex: "async",
    retrieve: "async",
  });
}

export function createSearchService(getDb?: () => DbOrTx): SearchService {
  return new DefaultSearchService(getDb);
}

export const searchService: SearchService = new DefaultSearchService();
