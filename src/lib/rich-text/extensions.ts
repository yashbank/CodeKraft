/**
 * Tiptap extension set for server-side rendering (ADR-10, docs/04 §7.7, docs/07 §4.7).
 *
 * The set mirrors `RICH_TEXT_NODE_TYPES` / `RICH_TEXT_MARK_TYPES` in `src/modules/_shared/zod.ts`
 * exactly: StarterKit (paragraph, text, lists, blockquote, code, codeBlock, hardBreak,
 * horizontalRule, bold, italic, underline, strike, link) plus our own `heading` (carries the
 * table-of-contents `id`), `image` and the four table nodes. The admin editor (P8) reuses
 * `richTextExtensions` so what the editor produces is exactly what the server can render.
 */
import { type Extensions, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

/** `heading` with a `level` and the anchor `id` the renderer assigns (docs/07 table of contents). */
export const Heading = Node.create({
  name: "heading",
  group: "block",
  content: "inline*",
  defining: true,
  addAttributes() {
    return {
      level: {
        default: 2,
        parseHTML: (element) => Number(element.tagName.slice(1)),
        renderHTML: () => ({}),
      },
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("id"),
        renderHTML: (attributes) =>
          typeof attributes["id"] === "string" && attributes["id"] !== ""
            ? { id: attributes["id"] }
            : {},
      },
    };
  },
  parseHTML() {
    return HEADING_LEVELS.map((level) => ({ tag: `h${level}`, attrs: { level } }));
  },
  renderHTML({ node, HTMLAttributes }) {
    const raw = Number(node.attrs["level"]);
    const level = (HEADING_LEVELS as readonly number[]).includes(raw) ? raw : 2;
    return [`h${level}`, mergeAttributes(HTMLAttributes), 0];
  },
});

/** Block image with mandatory `alt` (docs/07 §6 a11y); `src` is re-checked by the sanitizer. */
export const Image = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: false,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      title: { default: null },
      width: { default: null },
      height: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes({ loading: "lazy" }, HTMLAttributes)];
  },
});

export const Table = Node.create({
  name: "table",
  group: "block",
  content: "tableRow+",
  tableRole: "table",
  isolating: true,
  parseHTML() {
    return [{ tag: "table" }];
  },
  renderHTML() {
    return ["table", ["tbody", 0]];
  },
});

export const TableRow = Node.create({
  name: "tableRow",
  content: "(tableCell | tableHeader)*",
  tableRole: "row",
  parseHTML() {
    return [{ tag: "tr" }];
  },
  renderHTML() {
    return ["tr", 0];
  },
});

const cellAttributes = () => ({
  colspan: { default: 1 },
  rowspan: { default: 1 },
});

export const TableCell = Node.create({
  name: "tableCell",
  content: "block+",
  tableRole: "cell",
  isolating: true,
  addAttributes: cellAttributes,
  parseHTML() {
    return [{ tag: "td" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["td", mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableHeader = Node.create({
  name: "tableHeader",
  content: "block+",
  tableRole: "header_cell",
  isolating: true,
  addAttributes: cellAttributes,
  parseHTML() {
    return [{ tag: "th" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["th", mergeAttributes(HTMLAttributes), 0];
  },
});

/**
 * The full render set. Links render without `target` (the sanitizer adds `target`/`rel` for
 * external hosts only) and the editor-only helpers (history, cursors, keymaps) are switched off.
 */
export const richTextExtensions: Extensions = [
  StarterKit.configure({
    heading: false,
    undoRedo: false,
    dropcursor: false,
    gapcursor: false,
    listKeymap: false,
    trailingNode: false,
    link: {
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      HTMLAttributes: { target: null, rel: null, class: null },
    },
  }),
  Heading,
  Image,
  Table,
  TableRow,
  TableCell,
  TableHeader,
];

/** Alias kept for the PHASE-03 P3.10 risk note ("export `tiptapExtensions` for reuse"). */
export const tiptapExtensions = richTextExtensions;
