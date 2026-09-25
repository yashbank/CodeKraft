/**
 * Knowledge chunk indexer — docs/04 §9, docs/06 §3.3, API-CHAT-13, PHASE-03 P3.13.
 * Rebuilds knowledge_chunks from published products, offerings, services, FAQs, legal pages, and case studies.
 * Chunks plain text ≤ 1200 chars with titles, populates search_vector, and deletes stale rows atomically.
 */
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { knowledgeChunks } from "../../../drizzle/schema/chat";
import { products } from "../../../drizzle/schema/catalog";
import { offerings, offeringPrices } from "../../../drizzle/schema/offerings";
import { services, faqs, legalPages, caseStudies } from "../../../drizzle/schema/content";
import { toPlainText } from "../content/render";
import type { RichTextDoc } from "../_shared/zod";

export const MAX_CHUNK_LENGTH = 1200;

export const KNOWLEDGE_SOURCES = [
  "product",
  "offering",
  "service",
  "faq",
  "legal",
  "case_study",
] as const;
export type KnowledgeSource = (typeof KNOWLEDGE_SOURCES)[number];

export interface TextChunk {
  title: string;
  body: string;
}

/**
 * Split text into coherent chunks ≤ maxChunkLength (default 1200 characters).
 * Preserves paragraphs, sentences, or word boundaries where possible.
 */
export function chunkText(
  title: string,
  fullText: string,
  maxChunkLength = MAX_CHUNK_LENGTH,
): TextChunk[] {
  const text = fullText.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  if (text.length <= maxChunkLength) {
    return [{ title, body: text }];
  }

  const chunks: TextChunk[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentBody = "";
  let partNumber = 1;

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // If single paragraph exceeds maxChunkLength, split by sentences or chunks
    if (trimmedPara.length > maxChunkLength) {
      if (currentBody) {
        chunks.push({
          title: partNumber === 1 ? title : `${title} (Part ${partNumber})`,
          body: currentBody.trim(),
        });
        partNumber++;
        currentBody = "";
      }

      // Sub-chunk oversized paragraph by sentences
      const sentences = trimmedPara.split(/(?<=[.?!])\s+/);
      let subBody = "";
      for (const sentence of sentences) {
        if (sentence.length > maxChunkLength) {
          // Hard slice if a single word/sentence exceeds maxChunkLength
          if (subBody) {
            chunks.push({
              title: partNumber === 1 ? title : `${title} (Part ${partNumber})`,
              body: subBody.trim(),
            });
            partNumber++;
            subBody = "";
          }
          for (let i = 0; i < sentence.length; i += maxChunkLength) {
            chunks.push({
              title: partNumber === 1 ? title : `${title} (Part ${partNumber})`,
              body: sentence.slice(i, i + maxChunkLength).trim(),
            });
            partNumber++;
          }
        } else if (subBody.length + sentence.length + 1 <= maxChunkLength) {
          subBody = subBody ? `${subBody} ${sentence}` : sentence;
        } else {
          chunks.push({
            title: partNumber === 1 ? title : `${title} (Part ${partNumber})`,
            body: subBody.trim(),
          });
          partNumber++;
          subBody = sentence;
        }
      }
      if (subBody) {
        currentBody = subBody;
      }
    } else if (currentBody.length + trimmedPara.length + 2 <= maxChunkLength) {
      currentBody = currentBody ? `${currentBody}\n\n${trimmedPara}` : trimmedPara;
    } else {
      chunks.push({
        title: partNumber === 1 ? title : `${title} (Part ${partNumber})`,
        body: currentBody.trim(),
      });
      partNumber++;
      currentBody = trimmedPara;
    }
  }

  if (currentBody.trim()) {
    chunks.push({
      title: partNumber === 1 ? title : `${title} (Part ${partNumber})`,
      body: currentBody.trim(),
    });
  }

  return chunks;
}

export interface ChunkInsert {
  sourceType: KnowledgeSource;
  sourceId: string;
  title: string;
  body: string;
}

/**
 * Reindexes a single knowledge source (or specific sourceId within that source).
 * Deletes existing chunks for the source/entity and inserts new chunks within the provided transaction.
 */
export async function reindexSource(
  db: DbOrTx,
  sourceType: KnowledgeSource,
  sourceId?: string,
): Promise<{ chunksWritten: number }> {
  // 1. Delete stale chunks for this source (and specific entity if sourceId given)
  if (sourceId) {
    await db
      .delete(knowledgeChunks)
      .where(
        and(eq(knowledgeChunks.sourceType, sourceType), eq(knowledgeChunks.sourceId, sourceId)),
      );
  } else {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceType, sourceType));
  }

  const chunksToInsert: ChunkInsert[] = [];

  // 2. Extract content per source type
  switch (sourceType) {
    case "product": {
      const prodRows = await db
        .select()
        .from(products)
        .where(
          and(eq(products.status, "published"), sourceId ? eq(products.id, sourceId) : undefined),
        );

      for (const prod of prodRows) {
        const descText = toPlainText(prod.descriptionJson as RichTextDoc);
        let content = `${prod.name}\n${prod.shortDescription ?? ""}\n${descText}`.trim();

        // Include product-specific FAQs
        const prodFaqs = await db
          .select()
          .from(faqs)
          .where(
            and(eq(faqs.productId, prod.id), eq(faqs.published, true), eq(faqs.scope, "product")),
          );

        if (prodFaqs.length > 0) {
          const faqBlock = prodFaqs
            .map((f) => `Q: ${f.question}\nA: ${toPlainText(f.answerJson as RichTextDoc)}`)
            .join("\n\n");
          content += `\n\nFrequently Asked Questions:\n${faqBlock}`;
        }

        const pieces = chunkText(`Product: ${prod.name}`, content);
        for (const piece of pieces) {
          chunksToInsert.push({
            sourceType: "product",
            sourceId: prod.id,
            title: piece.title,
            body: piece.body,
          });
        }
      }
      break;
    }

    case "offering": {
      const offeringRows = await db
        .select({
          offering: offerings,
          product: products,
        })
        .from(offerings)
        .innerJoin(products, eq(offerings.productId, products.id))
        .where(
          and(
            eq(products.status, "published"),
            eq(offerings.status, "active"),
            sourceId ? eq(offerings.id, sourceId) : undefined,
          ),
        );

      for (const row of offeringRows) {
        const [priceRow] = await db
          .select()
          .from(offeringPrices)
          .where(
            and(eq(offeringPrices.offeringId, row.offering.id), eq(offeringPrices.currency, "INR")),
          )
          .limit(1);

        const instructions = toPlainText(row.offering.instructionsJson as RichTextDoc);
        const priceInfo = priceRow ? `Price: ₹${priceRow.amountMinor / 100}` : "";
        const content =
          `${row.product.name} - ${row.offering.name}\nDelivery: ${row.offering.deliveryType}\nModel: ${row.offering.purchaseModel}\n${priceInfo}\n${instructions}`.trim();

        const pieces = chunkText(`Offering: ${row.product.name} - ${row.offering.name}`, content);
        for (const piece of pieces) {
          chunksToInsert.push({
            sourceType: "offering",
            sourceId: row.offering.id,
            title: piece.title,
            body: piece.body,
          });
        }
      }
      break;
    }

    case "service": {
      const serviceRows = await db
        .select()
        .from(services)
        .where(and(eq(services.published, true), sourceId ? eq(services.id, sourceId) : undefined));

      for (const svc of serviceRows) {
        const bodyText = toPlainText(svc.bodyJson as RichTextDoc);
        const delivText = svc.deliverables?.length
          ? `Deliverables:\n- ${svc.deliverables.join("\n- ")}`
          : "";
        const content = `${svc.title}\n${svc.summary ?? ""}\n${delivText}\n${bodyText}`.trim();

        const pieces = chunkText(`Service: ${svc.title}`, content);
        for (const piece of pieces) {
          chunksToInsert.push({
            sourceType: "service",
            sourceId: svc.id,
            title: piece.title,
            body: piece.body,
          });
        }
      }
      break;
    }

    case "faq": {
      const faqRows = await db
        .select()
        .from(faqs)
        .where(
          and(
            eq(faqs.published, true),
            inArray(faqs.scope, ["site", "chatbot"]),
            sourceId ? eq(faqs.id, sourceId) : undefined,
          ),
        );

      for (const faq of faqRows) {
        const ans = toPlainText(faq.answerJson as RichTextDoc);
        const content = `Question: ${faq.question}\nAnswer: ${ans}`.trim();

        const pieces = chunkText(`FAQ: ${faq.question}`, content);
        for (const piece of pieces) {
          chunksToInsert.push({
            sourceType: "faq",
            sourceId: faq.id,
            title: piece.title,
            body: piece.body,
          });
        }
      }
      break;
    }

    case "legal": {
      const legalRows = await db
        .select()
        .from(legalPages)
        .where(
          and(
            isNotNull(legalPages.publishedAt),
            sourceId ? eq(legalPages.id, sourceId) : undefined,
          ),
        );

      for (const page of legalRows) {
        const content = `${page.title}\n${toPlainText(page.bodyJson as RichTextDoc)}`.trim();
        const pieces = chunkText(`Legal: ${page.title}`, content);
        for (const piece of pieces) {
          chunksToInsert.push({
            sourceType: "legal",
            sourceId: page.id,
            title: piece.title,
            body: piece.body,
          });
        }
      }
      break;
    }

    case "case_study": {
      const caseStudyRows = await db
        .select()
        .from(caseStudies)
        .where(
          and(eq(caseStudies.published, true), sourceId ? eq(caseStudies.id, sourceId) : undefined),
        );

      for (const cs of caseStudyRows) {
        const problem = toPlainText(cs.problemJson as RichTextDoc);
        const solution = toPlainText(cs.solutionJson as RichTextDoc);
        const results = toPlainText(cs.resultsJson as RichTextDoc);
        const tech = cs.techStack?.length ? `Tech: ${cs.techStack.join(", ")}` : "";
        const client = cs.clientName ? `Client: ${cs.clientName} (${cs.industry ?? ""})` : "";

        const content =
          `${cs.title}\n${client}\n${tech}\n\nProblem:\n${problem}\n\nSolution:\n${solution}\n\nResults:\n${results}`.trim();
        const pieces = chunkText(`Case Study: ${cs.title}`, content);
        for (const piece of pieces) {
          chunksToInsert.push({
            sourceType: "case_study",
            sourceId: cs.id,
            title: piece.title,
            body: piece.body,
          });
        }
      }
      break;
    }
  }

  // 3. Batch insert new chunks
  if (chunksToInsert.length > 0) {
    for (let i = 0; i < chunksToInsert.length; i += 50) {
      const batch = chunksToInsert.slice(i, i + 50);
      await db.insert(knowledgeChunks).values(batch);
    }
  }

  return { chunksWritten: chunksToInsert.length };
}

/**
 * Reindex all knowledge sources across the platform.
 */
export async function reindexAll(db: DbOrTx): Promise<{ chunks: number }> {
  let total = 0;
  for (const src of KNOWLEDGE_SOURCES) {
    const res = await reindexSource(db, src);
    total += res.chunksWritten;
  }
  return { chunks: total };
}

/**
 * Safe trigger for re-indexing a source or specific entity.
 * Swallows errors to prevent background hook failures while logging warnings.
 */
export async function triggerReindexSafe(
  sourceType: KnowledgeSource,
  sourceId?: string,
  tx?: DbOrTx,
): Promise<void> {
  try {
    let dbClient = tx;
    if (!dbClient) {
      const { db } = await import("@/lib/db");
      dbClient = db;
    }
    await reindexSource(dbClient, sourceType, sourceId);
  } catch (err) {
    console.error(`[search.indexer] failed to reindex ${sourceType}:${sourceId ?? "all"}`, err);
  }
}
