/**
 * Tiptap JSON → plain text for the knowledge indexer (docs/09 §11 "content sanitisation before
 * retrieval", TM-08). Local fallback so the indexer never depends on `src/lib/rich-text` (written
 * concurrently by another agent): marks are dropped, links keep their visible text only (URLs are
 * stripped), block nodes become paragraphs, list items are bulleted, tables become rows of cells.
 * Anything not on the ADR-10 allow-list is walked for its text and nothing else.
 */

export interface PlainTextNode {
  type?: unknown;
  text?: unknown;
  attrs?: unknown;
  content?: unknown;
}

const BLOCK_TYPES: ReadonlySet<string> = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "listItem",
  "table",
  "tableRow",
  "horizontalRule",
]);

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi;

function isNode(value: unknown): value is PlainTextNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function children(node: PlainTextNode): PlainTextNode[] {
  return Array.isArray(node.content) ? node.content.filter(isNode) : [];
}

function renderInline(node: PlainTextNode): string {
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "image") {
    const attrs = isNode(node.attrs) ? (node.attrs as Record<string, unknown>) : {};
    const alt = attrs["alt"];
    return typeof alt === "string" && alt.trim() !== "" ? `[image: ${alt.trim()}]` : "";
  }
  return children(node).map(renderInline).join("");
}

function renderBlock(node: PlainTextNode, depth: number): string[] {
  const type = typeof node.type === "string" ? node.type : "";
  switch (type) {
    case "bulletList":
    case "orderedList": {
      const out: string[] = [];
      children(node).forEach((item, i) => {
        const marker = type === "orderedList" ? `${i + 1}.` : "-";
        const lines = children(item).flatMap((c) => renderBlock(c, depth + 1));
        const joined = lines.join(" ").trim();
        if (joined !== "") out.push(`${marker} ${joined}`);
      });
      return out;
    }
    case "listItem":
      return children(node).flatMap((c) => renderBlock(c, depth + 1));
    case "table":
      return children(node).flatMap((row) => renderBlock(row, depth + 1));
    case "tableRow": {
      const cells = children(node)
        .map((cell) =>
          children(cell)
            .flatMap((c) => renderBlock(c, depth + 1))
            .join(" ")
            .trim(),
        )
        .filter((c) => c !== "");
      return cells.length > 0 ? [cells.join(" | ")] : [];
    }
    case "horizontalRule":
      return [];
    case "blockquote":
      return children(node).flatMap((c) => renderBlock(c, depth + 1));
    case "paragraph":
    case "heading":
    case "codeBlock":
      return [renderInline(node)];
    default:
      if (type === "text" || type === "hardBreak" || type === "image") return [renderInline(node)];
      // Unknown container: keep its text, drop its structure.
      return children(node).flatMap((c) => renderBlock(c, depth + 1));
  }
}

/** Collapse whitespace inside a line and strip URLs to nothing (their visible text is already kept). */
function cleanLine(line: string): string {
  return line
    .replace(URL_PATTERN, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // eslint-disable-line no-control-regex
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Plain text of a Tiptap document (or any node). Paragraphs are separated by a blank line so the
 * chunker can split on them; never throws on malformed input (returns what it could read).
 */
export function toPlainText(doc: unknown): string {
  if (typeof doc === "string") return cleanLine(doc);
  if (!isNode(doc)) return "";
  const blocks = doc.type === "doc" ? children(doc).flatMap((c) => renderBlock(c, 0)) : renderBlock(doc, 0);
  const lines = blocks
    .flatMap((b) => b.split("\n"))
    .map(cleanLine)
    .filter((l) => l !== "");
  return lines.join("\n\n");
}

/** Plain text of an optional rich-text column; `null`/`undefined`/unparseable → `""`. */
export function richTextToPlain(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    try {
      return toPlainText(JSON.parse(value));
    } catch {
      return cleanLine(value);
    }
  }
  return toPlainText(value);
}

/** Whether every type in the document is on `BLOCK_TYPES` / inline set — handy for tests. */
export const PLAIN_TEXT_BLOCK_TYPES: readonly string[] = Object.freeze([...BLOCK_TYPES]);
