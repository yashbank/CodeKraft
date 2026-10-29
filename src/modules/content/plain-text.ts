/**
 * Rich-text <-> plain-text helpers. Kept apart from render.ts so client components (admin editors,
 * account queries) can use them without bundling tiptap + sanitize-html (P15-02).
 */
import type { RichTextDoc, RichTextNode } from "@/modules/_shared/zod";

/**
 * Recursively extracts plain text from a Tiptap document or node tree.
 * Used for full-text search indexing, chat chunks, and teasers.
 */
export function toPlainText(doc: RichTextDoc | RichTextNode | null | undefined): string {
  if (!doc) return "";

  const pieces: string[] = [];

  function walk(node: RichTextNode | RichTextDoc) {
    if ("text" in node && typeof node.text === "string") {
      pieces.push(node.text);
    }
    if ("content" in node && Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(doc);
  return pieces.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Minimal plain-text → Tiptap doc bridge for the admin RichTextField, which is a plain
 * textarea until the real Tiptap editor lands (see RichTextField's own doc comment). Splits on
 * blank lines into paragraphs so admin-entered text round-trips through the existing
 * richTextSchema without needing a full editor.
 */
export function fromPlainText(text: string): RichTextDoc {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return { type: "doc", content: [] };
  }

  return {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  } as RichTextDoc;
}
