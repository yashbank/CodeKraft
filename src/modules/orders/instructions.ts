/**
 * Post-purchase instructions (A-601): `offerings.instructions_json` (Tiptap JSON) rendered to HTML
 * on the server and sanitised before it reaches the dashboard. Failures degrade to an empty string.
 */
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import sanitizeHtml from "sanitize-html";
import type { TiptapDoc } from "../../../drizzle/schema/catalog";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "code", "pre", "a", "h1", "h2", "h3", "h4",
  "ul", "ol", "li", "blockquote", "hr", "table", "thead", "tbody", "tr", "th", "td",
];

export function renderInstructionsHtml(doc: TiptapDoc | null | undefined): string {
  if (doc === null || doc === undefined) return "";
  try {
    const html = generateHTML(doc as Parameters<typeof generateHTML>[0], [StarterKit]);
    return sanitizeHtml(html, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: { a: ["href", "rel", "target"] },
      allowedSchemes: ["http", "https", "mailto"],
    });
  } catch {
    return "";
  }
}
