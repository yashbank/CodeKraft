/**
 * Tiptap JSON → sanitised HTML (ADR-10, docs/04 §7.7, SA-19). Server-only: importing this in
 * the browser throws so the sanitizer can never be bypassed by a client render.
 *
 * Pipeline: `normaliseDoc` (allow-list, safe URLs) → `assignHeadingIds` → `generateHTML`
 * (`@tiptap/html`, the same extension set the editor uses) → `sanitizeRichHtml` (second pass,
 * tag/attribute/scheme allow-list) — plus the plain-text projection for search and knowledge.
 */
import { generateHTML } from "@tiptap/html";
import { richTextExtensions } from "./extensions";
import { type HeadingEntry, assignHeadingIds, normaliseDoc } from "./normalise";
import { readingTimeMinutes, toPlainText, wordCount } from "./plain-text";
import { type SanitizeOptions, sanitizeRichHtml } from "./sanitize";
import type { TiptapDoc } from "../../../drizzle/schema/catalog";

if (typeof window !== "undefined") {
  throw new Error("src/lib/rich-text/render.ts is server-only and must not be imported in the browser");
}

export interface RenderedRichText {
  /** Sanitised HTML fragment (empty string for an empty document). */
  html: string;
  /** Table of contents in document order; every heading in `html` carries the matching `id`. */
  headings: HeadingEntry[];
  /** Plain-text projection (search, knowledge chunks). */
  text: string;
  wordCount: number;
  readingTimeMinutes: number;
}

export type RenderOptions = SanitizeOptions;

/**
 * Render a stored `body_json`. Never throws on malformed input: anything outside the allow-list
 * is dropped and the remainder rendered (the write path already rejected it via `richTextSchema`).
 */
export function renderRichText(
  doc: TiptapDoc | null | undefined,
  opts: RenderOptions = {},
): RenderedRichText {
  const safe = normaliseDoc(doc);
  const headings = assignHeadingIds(safe);
  const text = toPlainText(safe);
  const html = safe.content === undefined ? "" : sanitizeRichHtml(generateHTML(safe, richTextExtensions), opts);
  return { html, headings, text, wordCount: wordCount(text), readingTimeMinutes: readingTimeMinutes(text) };
}

/** Just the HTML — the common case in view builders. */
export function renderHtml(doc: TiptapDoc | null | undefined, opts: RenderOptions = {}): string {
  return renderRichText(doc, opts).html;
}
