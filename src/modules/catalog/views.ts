/**
 * Row → view mappers for the catalog read models (docs/06 §2.2 API-CAT-18/19/31/34/36).
 */
import type { Media } from "../../../drizzle/schema/media";
import type {
  Category,
  ProductFaq,
  ProductTestimonial,
  ProductVersion,
} from "../../../drizzle/schema/catalog";
import type {
  CategoryRef,
  ImageRef,
  ProductFaqView,
  ProductTestimonialView,
  ProductVersionView,
} from "./types";

export function toImageRef(media: Media, url: string, alt: string): ImageRef {
  return {
    mediaId: media.id,
    url,
    alt,
    width: media.width,
    height: media.height,
    blurHash: media.blurHash,
  };
}

export function toCategoryRef(c: Pick<Category, "id" | "slug" | "name"> | null | undefined) {
  return c === null || c === undefined ? null : ({ id: c.id, slug: c.slug, name: c.name } satisfies CategoryRef);
}

export function toFaqView(row: ProductFaq): ProductFaqView {
  return { id: row.id, question: row.question, answer: row.answerJson, position: row.position };
}

export function toVersionView(row: ProductVersion): ProductVersionView {
  return {
    version: row.version,
    changelog: row.changelogJson,
    releasedAt: row.releasedAt.toISOString(),
  };
}

export function toTestimonialView(
  row: ProductTestimonial,
  avatar: ImageRef | null,
): ProductTestimonialView & { position: number; published: boolean } {
  return {
    id: row.id,
    authorName: row.authorName,
    authorTitle: row.authorTitle,
    company: row.company,
    quote: row.quote,
    avatar,
    position: row.position,
    published: row.published,
  };
}

/** Plain-text projection of a Tiptap document (JSON-LD description, summaries). */
export function tiptapToText(doc: unknown, max = 500): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node !== "object" || node === null) return;
    const n = node as { text?: unknown; content?: unknown };
    if (typeof n.text === "string") parts.push(n.text);
    if (Array.isArray(n.content)) for (const child of n.content) walk(child);
  };
  walk(doc);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
