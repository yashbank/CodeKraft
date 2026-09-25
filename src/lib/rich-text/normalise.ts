/**
 * Document-level allow-list (ADR-10, TM-21). `richTextSchema` rejects anything outside the
 * allow-list before persisting; this pass re-applies the same rules to whatever is read back
 * (defence in depth, SA-19) and assigns table-of-contents ids to headings.
 *
 * Pure functions, no Tiptap dependency — usable by the plain-text extractor as well.
 */
import { RICH_TEXT_MARK_TYPES, RICH_TEXT_NODE_TYPES } from "@/modules/_shared/zod";
import type { TiptapDoc, TiptapNode } from "../../../drizzle/schema/catalog";

const NODE_TYPES: ReadonlySet<string> = new Set(RICH_TEXT_NODE_TYPES);
const MARK_TYPES: ReadonlySet<string> = new Set(RICH_TEXT_MARK_TYPES);

/** http(s), mailto or a root-relative path — the same rule as `richTextSchema`. */
export const SAFE_URL = /^(https?:\/\/|mailto:|\/(?!\/))/i;
/** Images may not be `mailto:`. */
const SAFE_IMAGE_URL = /^(https?:\/\/|\/(?!\/))/i;

/** Max nesting we follow (`RICH_TEXT_MAX_DEPTH` is 32; deeper content is dropped). */
const MAX_DEPTH = 32;

export interface HeadingEntry {
  id: string;
  level: number;
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Attribute values are scalars only (the schema's `richTextAttrsSchema`). */
function scalarAttrs(attrs: unknown): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!isRecord(attrs)) return out;
  for (const [key, value] of Object.entries(attrs)) {
    if (/^on/i.test(key) || key === "style") continue;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      out[key] = value as string | number | boolean | null;
    }
  }
  return out;
}

function safeMarks(marks: unknown): TiptapNode["marks"] {
  if (!Array.isArray(marks)) return undefined;
  const out: NonNullable<TiptapNode["marks"]> = [];
  for (const mark of marks) {
    if (!isRecord(mark) || typeof mark["type"] !== "string" || !MARK_TYPES.has(mark["type"])) {
      continue;
    }
    const attrs = scalarAttrs(mark["attrs"]);
    if (mark["type"] === "link") {
      const href = attrs["href"];
      if (typeof href !== "string" || !SAFE_URL.test(href)) continue;
      out.push({ type: "link", attrs: { href, ...(attrs["title"] !== undefined ? { title: attrs["title"] } : {}) } });
      continue;
    }
    out.push({ type: mark["type"] });
  }
  return out.length > 0 ? out : undefined;
}

function safeNode(input: unknown, depth: number): TiptapNode | null {
  if (depth > MAX_DEPTH || !isRecord(input)) return null;
  const type = input["type"];
  if (typeof type !== "string" || !NODE_TYPES.has(type)) return null;
  const node: TiptapNode = { type };
  const attrs = scalarAttrs(input["attrs"]);
  if (type === "image") {
    const src = attrs["src"];
    if (typeof src !== "string" || !SAFE_IMAGE_URL.test(src)) return null;
    node.attrs = {
      src,
      alt: typeof attrs["alt"] === "string" ? attrs["alt"] : "",
      ...(typeof attrs["title"] === "string" ? { title: attrs["title"] } : {}),
      ...(typeof attrs["width"] === "number" ? { width: attrs["width"] } : {}),
      ...(typeof attrs["height"] === "number" ? { height: attrs["height"] } : {}),
    };
  } else if (type === "heading") {
    const level = Number(attrs["level"]);
    node.attrs = { level: Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2 };
  } else if (type === "tableCell" || type === "tableHeader") {
    const span = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 1 && v <= 100 ? v : 1);
    node.attrs = { colspan: span(attrs["colspan"]), rowspan: span(attrs["rowspan"]) };
  } else if (type === "codeBlock") {
    const language = attrs["language"];
    node.attrs = { language: typeof language === "string" && /^[\w-]{1,32}$/.test(language) ? language : null };
  } else if (type === "orderedList") {
    const start = attrs["start"];
    node.attrs = { start: typeof start === "number" && Number.isInteger(start) && start >= 0 ? start : 1 };
  }
  if (type === "text") {
    if (typeof input["text"] !== "string" || input["text"] === "") return null;
    node.text = input["text"];
    const marks = safeMarks(input["marks"]);
    if (marks !== undefined) node.marks = marks;
    return node;
  }
  if (Array.isArray(input["content"])) {
    const content: TiptapNode[] = [];
    for (const child of input["content"]) {
      const safe = safeNode(child, depth + 1);
      if (safe !== null) content.push(safe);
    }
    if (content.length > 0) node.content = content;
  }
  // Tiptap's schema needs cells to hold at least one block and tables/rows at least one child.
  if ((type === "tableCell" || type === "tableHeader") && node.content === undefined) {
    node.content = [{ type: "paragraph" }];
  }
  if ((type === "table" || type === "tableRow") && node.content === undefined) return null;
  return node;
}

/**
 * Re-apply the allow-list: unknown nodes/marks, unsafe `href`/`src`, event-handler and `style`
 * attributes are dropped. Always returns a well-formed `doc` (possibly empty).
 */
export function normaliseDoc(doc: unknown): TiptapDoc {
  if (!isRecord(doc) || doc["type"] !== "doc" || !Array.isArray(doc["content"])) {
    return { type: "doc" };
  }
  const content: TiptapNode[] = [];
  for (const child of doc["content"]) {
    const safe = safeNode(child, 1);
    if (safe !== null) content.push(safe);
  }
  return content.length > 0 ? { type: "doc", content } : { type: "doc" };
}

/** Text of a node's inline content (no separators — used for heading titles). */
export function inlineText(node: TiptapNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return " ";
  return (node.content ?? []).map(inlineText).join("");
}

/** `Getting started, 2026!` → `getting-started-2026`; empty → `section`. Max 80 chars. */
export function slugifyHeading(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug === "" ? "section" : slug;
}

/**
 * Assign a unique `id` to every heading (in document order, `-2`, `-3` … on duplicates) and
 * return the table-of-contents entries. Mutates and returns the given (normalised) doc.
 */
export function assignHeadingIds(doc: TiptapDoc): HeadingEntry[] {
  const seen = new Map<string, number>();
  const headings: HeadingEntry[] = [];
  const visit = (node: TiptapNode): void => {
    if (node.type === "heading") {
      const text = inlineText(node).replace(/\s+/g, " ").trim();
      const base = slugifyHeading(text);
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      const id = count === 1 ? base : `${base}-${count}`;
      node.attrs = { ...(node.attrs ?? {}), id };
      headings.push({ id, level: Number(node.attrs["level"] ?? 2), text });
      return;
    }
    for (const child of node.content ?? []) visit(child);
  };
  for (const child of doc.content ?? []) visit(child);
  return headings;
}
