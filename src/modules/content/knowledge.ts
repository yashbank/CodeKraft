/**
 * Plain-text extracts for the knowledge indexer (P3.13 `knowledge.reindex`, docs/04 §9):
 * published services, site/chatbot FAQs, latest published legal texts and case studies. The
 * indexer chunks and stores them; this module only reads and projects.
 */
import { eq, or } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { toPlainText } from "@/lib/rich-text/plain-text";
import { faqs } from "../../../drizzle/schema/content";
import { createCaseStudyOps } from "./case-studies";
import { withDefaults } from "./deps";
import { reader, siteUrl } from "./internal";
import { createLegalOps } from "./legal";
import { createServiceOps } from "./services";

/** `knowledge_chunks.source_type` values this module produces. */
export type ContentKnowledgeSourceType = "service" | "faq" | "legal" | "case_study";

export interface KnowledgeExtract<S extends string = ContentKnowledgeSourceType> {
  sourceType: S;
  sourceId: string;
  title: string;
  /** Plain text (one line per block), ready for chunking. */
  text: string;
  /** Public URL of the source, when it has one. */
  url: string | null;
  updatedAt: string;
}

export async function listForKnowledge(tx?: DbOrTx): Promise<KnowledgeExtract[]> {
  const deps = withDefaults();
  const db = reader(tx);
  const out: KnowledgeExtract[] = [];

  for (const s of await createServiceOps(deps).listPublishedServices(db)) {
    const text = [s.summary ?? "", ...(s.deliverables ?? []).map((d) => `- ${d}`), toPlainText(s.bodyJson)]
      .filter((line) => line !== "")
      .join("\n");
    out.push({
      sourceType: "service",
      sourceId: s.id,
      title: s.title,
      text,
      url: `${siteUrl()}/services#${s.slug}`,
      updatedAt: s.updatedAt.toISOString(),
    });
  }

  const faqRows = await db
    .select()
    .from(faqs)
    .where(or(eq(faqs.scope, "site"), eq(faqs.scope, "chatbot")));
  for (const f of faqRows) {
    if (!f.published) continue;
    out.push({
      sourceType: "faq",
      sourceId: f.id,
      title: f.question,
      text: toPlainText(f.answerJson),
      url: f.scope === "site" ? `${siteUrl()}/#faq` : null,
      updatedAt: f.updatedAt.toISOString(),
    });
  }

  for (const { page, version } of await createLegalOps(deps).listLatestPublished(db)) {
    out.push({
      sourceType: "legal",
      sourceId: page.id,
      title: page.title,
      text: toPlainText(version.bodyJson),
      url: `${siteUrl()}/legal/${page.key}`,
      updatedAt: version.publishedAt.toISOString(),
    });
  }

  const cs = createCaseStudyOps(deps);
  let cursor: string | undefined;
  do {
    const page = await cs.listPublished({ limit: 100, ...(cursor === undefined ? {} : { cursor }) }, db);
    for (const c of page.items) {
      const text = [
        c.clientName === null ? "" : `Client: ${c.clientName}`,
        c.industry === null ? "" : `Industry: ${c.industry}`,
        c.techStack.length === 0 ? "" : `Tech stack: ${c.techStack.join(", ")}`,
        "Problem:",
        toPlainText(c.problemJson),
        "Solution:",
        toPlainText(c.solutionJson),
        "Results:",
        toPlainText(c.resultsJson),
      ]
        .filter((line) => line !== "")
        .join("\n");
      out.push({
        sourceType: "case_study",
        sourceId: c.id,
        title: c.title,
        text,
        url: `${siteUrl()}/projects/${c.slug}`,
        updatedAt: c.updatedAt.toISOString(),
      });
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);

  return out;
}
