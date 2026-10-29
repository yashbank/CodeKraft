/**
 * Content rich-text render & plain-text extraction (PHASE-03 P3.10, ADR-10, TM-21, SA-19).
 * Converts Tiptap JSON AST to sanitized HTML and plain-text.
 */
import { generateHTML } from "@tiptap/html";
import { StarterKit } from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { Underline } from "@tiptap/extension-underline";
import type { RichTextDoc } from "@/modules/_shared/zod";
import { sanitizeHtml } from "./sanitize";

export const tiptapExtensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3, 4, 5, 6],
    },
    link: false,
    underline: false,
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      rel: "noopener noreferrer",
      target: "_blank",
    },
  }),
  Image.configure({
    inline: false,
    allowBase64: false,
  }),
  Table.configure({
    resizable: false,
  }),
  TableRow,
  TableHeader,
  TableCell,
  Underline,
];

/**
 * Render Tiptap JSON document to sanitized HTML.
 * Passes through generateHTML and then strict sanitize-html (ADR-10, TM-21, SA-19).
 */
export function renderToHtml(doc: RichTextDoc | null | undefined): string {
  if (!doc || !doc.content || doc.content.length === 0) {
    return "";
  }

  try {
    const rawHtml = generateHTML(
      doc as unknown as Parameters<typeof generateHTML>[0],
      tiptapExtensions,
    );
    return sanitizeHtml(rawHtml);
  } catch {
    // If AST is malformed or generateHTML fails, fall back to safe empty string
    return "";
  }
}

// Re-exported so server callers keep importing them from here; client code imports ./plain-text.
export { fromPlainText, toPlainText } from "./plain-text";
