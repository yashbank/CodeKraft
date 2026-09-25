/**
 * Knowledge chunk retriever — docs/04 §9, docs/06 §3.3, PHASE-03 P3.13.
 * Retrieves top k chunks matching query ordered by ts_rank.
 */
import { eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { knowledgeChunks } from "../../../drizzle/schema/chat";
import { products } from "../../../drizzle/schema/catalog";
import { offerings } from "../../../drizzle/schema/offerings";
import { services, legalPages, caseStudies } from "../../../drizzle/schema/content";
import { sanitizeSearchQuery } from "./parser";
import type { KnowledgeSource } from "./indexer";

export interface RetrievedChunk {
  chunkId: string;
  sourceType: KnowledgeSource;
  sourceId: string;
  title: string;
  body: string;
  href: string;
  rank: number;
}

export async function retrieveKnowledge(
  db: DbOrTx,
  rawQuery: string,
  k = 8,
): Promise<RetrievedChunk[]> {
  const cleanQuery = sanitizeSearchQuery(rawQuery);
  if (!cleanQuery) return [];

  // Query chunks using PostgreSQL websearch_to_tsquery and ILIKE fallback
  const rows = await db
    .select({
      id: knowledgeChunks.id,
      sourceType: knowledgeChunks.sourceType,
      sourceId: knowledgeChunks.sourceId,
      title: knowledgeChunks.title,
      body: knowledgeChunks.body,
    })
    .from(knowledgeChunks)
    .where(
      sql`(${knowledgeChunks.searchVector} @@ websearch_to_tsquery('english', ${cleanQuery})
          OR ${knowledgeChunks.title} ILIKE ${`%${cleanQuery}%`}
          OR ${knowledgeChunks.body} ILIKE ${`%${cleanQuery}%`})`,
    )
    .orderBy(
      sql`ts_rank(${knowledgeChunks.searchVector}, websearch_to_tsquery('english', ${cleanQuery})) DESC, ${knowledgeChunks.createdAt} DESC`,
    )
    .limit(k);

  if (rows.length === 0) return [];

  // Resolve hrefs per source type
  const productIds = rows.filter((r) => r.sourceType === "product").map((r) => r.sourceId);
  const offeringIds = rows.filter((r) => r.sourceType === "offering").map((r) => r.sourceId);
  const serviceIds = rows.filter((r) => r.sourceType === "service").map((r) => r.sourceId);
  const legalIds = rows.filter((r) => r.sourceType === "legal").map((r) => r.sourceId);
  const caseStudyIds = rows.filter((r) => r.sourceType === "case_study").map((r) => r.sourceId);

  const hrefMap = new Map<string, string>();

  if (productIds.length > 0) {
    const prods = await db
      .select({ id: products.id, slug: products.slug })
      .from(products)
      .where(inArray(products.id, productIds));
    for (const p of prods) {
      hrefMap.set(p.id, `/products/${p.slug}`);
    }
  }

  if (offeringIds.length > 0) {
    const offs = await db
      .select({ id: offerings.id, productSlug: products.slug })
      .from(offerings)
      .innerJoin(products, eq(offerings.productId, products.id))
      .where(inArray(offerings.id, offeringIds));
    for (const o of offs) {
      hrefMap.set(o.id, `/products/${o.productSlug}`);
    }
  }

  if (serviceIds.length > 0) {
    const svcs = await db
      .select({ id: services.id, slug: services.slug })
      .from(services)
      .where(inArray(services.id, serviceIds));
    for (const s of svcs) {
      hrefMap.set(s.id, `/services#${s.slug}`);
    }
  }

  if (legalIds.length > 0) {
    const legals = await db
      .select({ id: legalPages.id, key: legalPages.key })
      .from(legalPages)
      .where(inArray(legalPages.id, legalIds));
    for (const l of legals) {
      hrefMap.set(l.id, `/legal/${l.key}`);
    }
  }

  if (caseStudyIds.length > 0) {
    const csList = await db
      .select({ id: caseStudies.id, slug: caseStudies.slug })
      .from(caseStudies)
      .where(inArray(caseStudies.id, caseStudyIds));
    for (const cs of csList) {
      hrefMap.set(cs.id, `/case-studies/${cs.slug}`);
    }
  }

  return rows.map((r, index) => {
    let href = "/";
    if (r.sourceType === "faq") {
      href = "/faq";
    } else {
      href = hrefMap.get(r.sourceId) ?? "/";
    }

    return {
      chunkId: r.id,
      sourceType: r.sourceType as KnowledgeSource,
      sourceId: r.sourceId,
      title: r.title,
      body: r.body,
      href,
      rank: 1 / (index + 1), // Standard positional rank
    };
  });
}
