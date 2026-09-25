/**
 * Plain-text projection of a Tiptap document — search vectors, chat knowledge chunks (P3.13),
 * excerpts and `description` meta fallbacks. Pure: no DOM, no Tiptap.
 */
import { normaliseDoc } from "./normalise";
import type { TiptapDoc, TiptapNode } from "../../../drizzle/schema/catalog";

/** Nodes that end a line. */
const BLOCK_TYPES: ReadonlySet<string> = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "listItem",
  "bulletList",
  "orderedList",
  "tableRow",
  "table",
  "horizontalRule",
  "image",
]);

function collect(node: TiptapNode, out: string[]): void {
  switch (node.type) {
    case "text":
      out.push(node.text ?? "");
      return;
    case "hardBreak":
      out.push("\n");
      return;
    case "horizontalRule":
      out.push("\n");
      return;
    case "image": {
      const alt = node.attrs?.["alt"];
      if (typeof alt === "string" && alt.trim() !== "") out.push(`${alt.trim()}\n`);
      return;
    }
    case "tableCell":
    case "tableHeader": {
      const parts: string[] = [];
      for (const child of node.content ?? []) collect(child, parts);
      out.push(`${parts.join("").replace(/\s*\n\s*/g, " ").trim()}\t`);
      return;
    }
    default: {
      for (const child of node.content ?? []) collect(child, out);
      if (BLOCK_TYPES.has(node.type)) out.push("\n");
    }
  }
}

/**
 * Text content with one line per block, list items and table rows preserved as lines, cells
 * separated by tabs; runs of blank lines are collapsed. Unknown nodes are dropped first.
 */
export function toPlainText(doc: TiptapDoc | null | undefined): string {
  if (doc === null || doc === undefined) return "";
  const safe = normaliseDoc(doc);
  const out: string[] = [];
  for (const child of safe.content ?? []) collect(child, out);
  return out
    .join("")
    .replace(/\t\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Single-line excerpt of at most `max` characters, cut on a word boundary with an ellipsis. */
export function excerpt(doc: TiptapDoc | null | undefined, max = 160): string {
  const text = toPlainText(doc).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max / 2 ? cut.slice(0, at) : cut.slice(0, max)).trimEnd()}…`;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Minutes at ~200 words per minute, minimum 1 for non-empty text. */
export function readingTimeMinutes(text: string): number {
  const words = wordCount(text);
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
}
