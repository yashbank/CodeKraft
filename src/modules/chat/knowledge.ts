/**
 * Knowledge indexer + retriever — docs/04 §9 (knowledge source), API-CHAT-13, docs/06 §3.3
 * `knowledge.reindex`, PHASE-03 P3.13 (owned here per the wave-3 split), TM-08.
 *
 * Rebuilds `knowledge_chunks` from the published rows of products (+ product FAQs, product blogs),
 * offerings, services, site/chatbot FAQs, legal pages and case studies. Text is plain
 * (`plain-text.ts`), chunked at ~800 characters on paragraph boundaries, and stale rows of a
 * source are removed in the same transaction. Retrieval is Postgres full-text (`ts_rank`, top-8,
 * A-304). The indexer reads the content tables directly through drizzle (never their services).
 */
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { DbOrTx, TxCtx, TxRunner } from "@/lib/db";
import { withTx } from "@/lib/db";
import { productBlogs, productFaqs, products } from "../../../drizzle/schema/catalog";
import { knowledgeChunks } from "../../../drizzle/schema/chat";
import { caseStudies, faqs, legalPages, services } from "../../../drizzle/schema/content";
import { offeringPrices, offerings } from "../../../drizzle/schema/offerings";
import { richTextToPlain } from "./plain-text";
import { KNOWLEDGE_SOURCE_TYPES, type KnowledgeSourceType, type RetrievedChunk } from "./types";

export const CHUNK_TARGET_CHARS = 800;
export const CHUNK_MAX_CHARS = 1_200;
export const RETRIEVE_DEFAULT_LIMIT = 8;

/** One indexable document before chunking. */
export interface KnowledgeDocument {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  body: string;
  href: string;
}

// ---------------------------------------------------------------------------------------------
// Chunker
// ---------------------------------------------------------------------------------------------

function splitLong(paragraph: string, max: number): string[] {
  if (paragraph.length <= max) return [paragraph];
  const out: string[] = [];
  let rest = paragraph;
  while (rest.length > max) {
    // Prefer a sentence boundary, then a space, then a hard cut.
    let cut = rest.lastIndexOf(". ", max);
    if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut + (rest[cut] === "." ? 1 : 0)).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest !== "") out.push(rest);
  return out;
}

/**
 * Split plain text into chunks of about `target` characters (never more than `max`), on paragraph
 * boundaries when possible; sentences are the fallback for very long paragraphs.
 */
export function chunkText(
  text: string,
  target: number = CHUNK_TARGET_CHARS,
  max: number = CHUNK_MAX_CHARS,
): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .flatMap((p) => splitLong(p, max));
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current === "") {
      current = p;
      continue;
    }
    if (current.length + 2 + p.length <= target) {
      current = `${current}\n\n${p}`;
    } else {
      chunks.push(current);
      current = p;
    }
  }
  if (current !== "") chunks.push(current);
  return chunks;
}

// ---------------------------------------------------------------------------------------------
// Document builders (published rows only)
// ---------------------------------------------------------------------------------------------

function bullets(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return items
    .map((b) => {
      if (typeof b === "string") return `- ${b}`;
      if (typeof b === "object" && b !== null) {
        const o = b as { title?: unknown; description?: unknown };
        const title = typeof o.title === "string" ? o.title : "";
        const description = typeof o.description === "string" ? o.description : "";
        const line = [title, description].filter((s) => s !== "").join(": ");
        return line === "" ? "" : `- ${line}`;
      }
      return "";
    })
    .filter((l) => l !== "")
    .join("\n");
}

function formatMinor(amountMinor: number, currency: string): string {
  const whole = Math.trunc(amountMinor / 100);
  const frac = Math.abs(amountMinor % 100);
  return `${whole}.${String(frac).padStart(2, "0")} ${currency}`;
}

function section(label: string, text: string): string {
  return text.trim() === "" ? "" : `${label}\n${text.trim()}`;
}

function join(parts: string[]): string {
  return parts.filter((p) => p.trim() !== "").join("\n\n");
}

export async function buildProductDocuments(db: DbOrTx): Promise<KnowledgeDocument[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      shortDescription: products.shortDescription,
      descriptionJson: products.descriptionJson,
      features: products.features,
      benefits: products.benefits,
      targetAudience: products.targetAudience,
      useCases: products.useCases,
      industry: products.industry,
      techStack: products.techStack,
      requirementsJson: products.requirementsJson,
    })
    .from(products)
    .where(and(eq(products.status, "published"), eq(products.isUnlisted, false)));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const faqRows = await db
    .select({
      productId: productFaqs.productId,
      question: productFaqs.question,
      answerJson: productFaqs.answerJson,
      position: productFaqs.position,
    })
    .from(productFaqs)
    .where(inArray(productFaqs.productId, ids))
    .orderBy(productFaqs.position);
  const blogRows = await db
    .select({
      productId: productBlogs.productId,
      title: productBlogs.title,
      slug: productBlogs.slug,
      excerpt: productBlogs.excerpt,
      bodyJson: productBlogs.bodyJson,
    })
    .from(productBlogs)
    .where(and(inArray(productBlogs.productId, ids), eq(productBlogs.status, "published")));

  const docs: KnowledgeDocument[] = [];
  for (const p of rows) {
    const href = `/products/${p.slug}`;
    docs.push({
      sourceType: "product",
      sourceId: p.id,
      title: p.name,
      href,
      body: join([
        p.shortDescription,
        richTextToPlain(p.descriptionJson),
        section("Features:", bullets(p.features)),
        section("Benefits:", bullets(p.benefits)),
        section("Target audience:", bullets(p.targetAudience)),
        section("Use cases:", bullets(p.useCases)),
        p.techStack.length > 0 ? `Tech stack: ${p.techStack.join(", ")}` : "",
        p.industry.length > 0 ? `Industries: ${p.industry.join(", ")}` : "",
        section("Requirements:", richTextToPlain(p.requirementsJson)),
      ]),
    });
    for (const f of faqRows.filter((f) => f.productId === p.id)) {
      docs.push({
        sourceType: "product",
        sourceId: p.id,
        title: `${p.name} — FAQ: ${f.question}`,
        href: `${href}#faq`,
        body: join([f.question, richTextToPlain(f.answerJson)]),
      });
    }
    // Product blogs have no `knowledge_source_type` of their own (frozen enum): indexed with their
    // product so publish/unpublish of the product refreshes them (docs/06 API-CHAT-13).
    for (const b of blogRows.filter((b) => b.productId === p.id)) {
      docs.push({
        sourceType: "product",
        sourceId: p.id,
        title: `Blog: ${b.title}`,
        href: `/blog/${b.slug}`,
        body: join([b.excerpt ?? "", richTextToPlain(b.bodyJson)]),
      });
    }
  }
  return docs;
}

export async function buildOfferingDocuments(db: DbOrTx): Promise<KnowledgeDocument[]> {
  const rows = await db
    .select({
      id: offerings.id,
      name: offerings.name,
      productName: products.name,
      productSlug: products.slug,
      slug: offerings.slug,
      purchaseModel: offerings.purchaseModel,
      billingInterval: offerings.billingInterval,
      trialDays: offerings.trialDays,
      licenseType: offerings.licenseType,
      deliveryType: offerings.deliveryType,
      serviceSteps: offerings.serviceSteps,
    })
    .from(offerings)
    .innerJoin(products, eq(products.id, offerings.productId))
    .where(
      and(
        eq(offerings.status, "active"),
        eq(products.status, "published"),
        eq(products.isUnlisted, false),
      ),
    );
  if (rows.length === 0) return [];
  const prices = await db
    .select({
      offeringId: offeringPrices.offeringId,
      currency: offeringPrices.currency,
      amountMinor: offeringPrices.amountMinor,
    })
    .from(offeringPrices)
    .where(
      inArray(
        offeringPrices.offeringId,
        rows.map((r) => r.id),
      ),
    );
  return rows.map((o) => {
    const priceLines = prices
      .filter((p) => p.offeringId === o.id)
      .map((p) => formatMinor(p.amountMinor, p.currency.trim()));
    const steps = Array.isArray(o.serviceSteps)
      ? o.serviceSteps
          .map((s) => (typeof s === "object" && s !== null ? (s as { title?: unknown }).title : s))
          .filter((t): t is string => typeof t === "string")
      : [];
    return {
      sourceType: "offering",
      sourceId: o.id,
      title: `${o.productName} — ${o.name}`,
      href: `/products/${o.productSlug}#${o.slug}`,
      body: join([
        `Offering "${o.name}" of ${o.productName}.`,
        `Purchase model: ${o.purchaseModel.replace("_", " ")}${o.billingInterval ? ` (${o.billingInterval})` : ""}.`,
        priceLines.length > 0 ? `Price: ${priceLines.join(" / ")}.` : "",
        o.trialDays ? `Trial: ${o.trialDays} days.` : "",
        o.licenseType ? `License: ${o.licenseType}.` : "",
        `Delivery: ${o.deliveryType.replace("_", " ")}.`,
        steps.length > 0 ? section("Service steps:", steps.map((s) => `- ${s}`).join("\n")) : "",
      ]),
    };
  });
}

export async function buildServiceDocuments(db: DbOrTx): Promise<KnowledgeDocument[]> {
  const rows = await db
    .select({
      id: services.id,
      slug: services.slug,
      title: services.title,
      summary: services.summary,
      deliverables: services.deliverables,
      bodyJson: services.bodyJson,
    })
    .from(services)
    .where(eq(services.published, true))
    .orderBy(services.position);
  return rows.map((s) => ({
    sourceType: "service",
    sourceId: s.id,
    title: s.title,
    href: `/services#${s.slug}`,
    body: join([
      s.summary ?? "",
      richTextToPlain(s.bodyJson),
      section("Deliverables:", bullets(s.deliverables)),
    ]),
  }));
}

export async function buildFaqDocuments(db: DbOrTx): Promise<KnowledgeDocument[]> {
  const rows = await db
    .select({
      id: faqs.id,
      question: faqs.question,
      answerJson: faqs.answerJson,
      scope: faqs.scope,
      productSlug: products.slug,
    })
    .from(faqs)
    .leftJoin(products, eq(products.id, faqs.productId))
    .where(eq(faqs.published, true))
    .orderBy(faqs.position);
  return rows.map((f) => ({
    sourceType: "faq",
    sourceId: f.id,
    title: f.question,
    href: f.scope === "product" && f.productSlug ? `/products/${f.productSlug}#faq` : "/faq",
    body: join([f.question, richTextToPlain(f.answerJson)]),
  }));
}

export async function buildLegalDocuments(db: DbOrTx): Promise<KnowledgeDocument[]> {
  const rows = await db
    .select({ id: legalPages.id, key: legalPages.key, title: legalPages.title, bodyJson: legalPages.bodyJson })
    .from(legalPages)
    .where(isNotNull(legalPages.publishedAt));
  return rows.map((l) => ({
    sourceType: "legal",
    sourceId: l.id,
    title: l.title,
    href: `/legal/${l.key}`,
    body: richTextToPlain(l.bodyJson),
  }));
}

export async function buildCaseStudyDocuments(db: DbOrTx): Promise<KnowledgeDocument[]> {
  const rows = await db
    .select({
      id: caseStudies.id,
      slug: caseStudies.slug,
      title: caseStudies.title,
      clientName: caseStudies.clientName,
      industry: caseStudies.industry,
      problemJson: caseStudies.problemJson,
      solutionJson: caseStudies.solutionJson,
      resultsJson: caseStudies.resultsJson,
      techStack: caseStudies.techStack,
    })
    .from(caseStudies)
    .where(eq(caseStudies.published, true));
  return rows.map((c) => ({
    sourceType: "case_study",
    sourceId: c.id,
    title: c.title,
    href: `/projects/${c.slug}`,
    body: join([
      [c.clientName ? `Client: ${c.clientName}.` : "", c.industry ? `Industry: ${c.industry}.` : ""]
        .filter((s) => s !== "")
        .join(" "),
      section("Problem:", richTextToPlain(c.problemJson)),
      section("Solution:", richTextToPlain(c.solutionJson)),
      section("Results:", richTextToPlain(c.resultsJson)),
      c.techStack.length > 0 ? `Tech stack: ${c.techStack.join(", ")}` : "",
    ]),
  }));
}

const BUILDERS: Readonly<Record<KnowledgeSourceType, (db: DbOrTx) => Promise<KnowledgeDocument[]>>> =
  Object.freeze({
    product: buildProductDocuments,
    offering: buildOfferingDocuments,
    service: buildServiceDocuments,
    faq: buildFaqDocuments,
    legal: buildLegalDocuments,
    case_study: buildCaseStudyDocuments,
  });

/** Every document for `sourceType` (or all types), in a stable order. */
export async function buildKnowledgeDocuments(
  db: DbOrTx,
  sourceType?: KnowledgeSourceType,
): Promise<KnowledgeDocument[]> {
  const types = sourceType === undefined ? KNOWLEDGE_SOURCE_TYPES : [sourceType];
  const out: KnowledgeDocument[] = [];
  for (const t of types) out.push(...(await BUILDERS[t](db)));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Reindex
// ---------------------------------------------------------------------------------------------

export interface ReindexOutcome {
  chunks: number;
  bySource: Partial<Record<KnowledgeSourceType, number>>;
}

/** `title` + chunk body rows for one document (title carries the href as a stable suffix). */
export function documentToChunkRows(doc: KnowledgeDocument): Array<{
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  body: string;
}> {
  const pieces = chunkText(doc.body);
  if (pieces.length === 0) return [];
  return pieces.map((body, i) => ({
    sourceType: doc.sourceType,
    sourceId: doc.sourceId,
    title: pieces.length > 1 ? `${doc.title} (${i + 1}/${pieces.length})` : doc.title,
    body: `${body}\n\n[href:${doc.href}]`,
  }));
}

/** `href` stored as a trailer of `body` (no href column in the frozen schema) — parsed back on read. */
export function splitHref(body: string): { text: string; href: string } {
  const m = /\n\n\[href:([^\]]+)\]$/.exec(body);
  if (m === null) return { text: body, href: "/" };
  return { text: body.slice(0, m.index), href: m[1] ?? "/" };
}

/**
 * Rebuild `knowledge_chunks` for `sourceType` (all types when omitted). Stale rows of the source
 * are deleted in the same transaction; runs inside `outerTx` when given.
 */
export async function reindexKnowledge(
  db: DbOrTx,
  sourceType?: KnowledgeSourceType,
  outerTx?: TxCtx,
): Promise<ReindexOutcome> {
  const docs = await buildKnowledgeDocuments(db, sourceType);
  const rows = docs.flatMap(documentToChunkRows);
  const types = sourceType === undefined ? [...KNOWLEDGE_SOURCE_TYPES] : [sourceType];
  await withTx(
    async (tx) => {
      await tx.delete(knowledgeChunks).where(inArray(knowledgeChunks.sourceType, types));
      for (let i = 0; i < rows.length; i += 200) {
        await tx.insert(knowledgeChunks).values(rows.slice(i, i + 200));
      }
    },
    outerTx,
    db as TxRunner,
  );
  const bySource: Partial<Record<KnowledgeSourceType, number>> = {};
  for (const r of rows) bySource[r.sourceType] = (bySource[r.sourceType] ?? 0) + 1;
  return { chunks: rows.length, bySource };
}

// ---------------------------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------------------------

/** Full-text top-`limit` chunks by `ts_rank` (`websearch_to_tsquery`, english). */
export async function retrieveChunks(
  db: DbOrTx,
  query: string,
  limit: number = RETRIEVE_DEFAULT_LIMIT,
): Promise<RetrievedChunk[]> {
  const q = query.trim().slice(0, 500);
  if (q === "") return [];
  const tsquery = sql`websearch_to_tsquery('english', ${q})`;
  const rank = sql<number>`ts_rank(${knowledgeChunks.searchVector}, ${tsquery})`;
  const rows = await db
    .select({
      id: knowledgeChunks.id,
      sourceType: knowledgeChunks.sourceType,
      sourceId: knowledgeChunks.sourceId,
      title: knowledgeChunks.title,
      body: knowledgeChunks.body,
      rank,
    })
    .from(knowledgeChunks)
    .where(sql`${knowledgeChunks.searchVector} @@ ${tsquery}`)
    .orderBy(desc(rank), knowledgeChunks.title)
    .limit(Math.max(1, Math.min(limit, 20)));
  return rows.map((r) => {
    const { text, href } = splitHref(r.body);
    return {
      chunkId: r.id,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      title: r.title,
      body: text,
      href,
      rank: Number(r.rank),
    };
  });
}
