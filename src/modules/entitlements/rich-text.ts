/**
 * Minimal, escape-first renderer for `offerings.instructions_json` (Tiptap JSON, ADR-10 allow-list)
 * → `EntitlementView.instructionsHtml` (A-601). Every text node is HTML-escaped; only the
 * allow-listed node/mark types produce tags; `href`/`src` must be http(s), mailto or relative.
 * Unknown nodes render their children only. Pure — no DOM, no dependencies, safe in jsdom.
 *
 * The full Tiptap → sanitised HTML renderer (P3.10) can replace this through
 * `EntitlementsDeps.renderRichText` without touching callers.
 */
import type { TiptapDoc, TiptapNode } from "../../../drizzle/schema/catalog";

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/))/i;

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function attr(value: unknown): string | null {
  return typeof value === "string" && SAFE_HREF.test(value) ? escapeHtml(value) : null;
}

function renderMarks(text: string, node: TiptapNode): string {
  let out = text;
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        out = `<strong>${out}</strong>`;
        break;
      case "italic":
        out = `<em>${out}</em>`;
        break;
      case "underline":
        out = `<u>${out}</u>`;
        break;
      case "strike":
        out = `<s>${out}</s>`;
        break;
      case "code":
        out = `<code>${out}</code>`;
        break;
      case "link": {
        const href = attr(mark.attrs?.["href"]);
        if (href !== null) {
          out = `<a href="${href}" rel="noopener noreferrer nofollow">${out}</a>`;
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function renderChildren(node: TiptapNode, depth: number): string {
  return (node.content ?? []).map((child) => renderNode(child, depth + 1)).join("");
}

const MAX_DEPTH = 32;

function renderNode(node: TiptapNode, depth: number): string {
  if (depth > MAX_DEPTH) return "";
  switch (node.type) {
    case "text":
      return renderMarks(escapeHtml(node.text ?? ""), node);
    case "paragraph":
      return `<p>${renderChildren(node, depth)}</p>`;
    case "heading": {
      const raw = Number(node.attrs?.["level"] ?? 2);
      const level = Number.isInteger(raw) && raw >= 1 && raw <= 6 ? raw : 2;
      return `<h${String(level)}>${renderChildren(node, depth)}</h${String(level)}>`;
    }
    case "bulletList":
      return `<ul>${renderChildren(node, depth)}</ul>`;
    case "orderedList":
      return `<ol>${renderChildren(node, depth)}</ol>`;
    case "listItem":
      return `<li>${renderChildren(node, depth)}</li>`;
    case "blockquote":
      return `<blockquote>${renderChildren(node, depth)}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${renderChildren(node, depth)}</code></pre>`;
    case "hardBreak":
      return "<br>";
    case "horizontalRule":
      return "<hr>";
    case "image": {
      const src = attr(node.attrs?.["src"]);
      if (src === null) return "";
      const alt = escapeHtml(typeof node.attrs?.["alt"] === "string" ? node.attrs["alt"] : "");
      return `<img src="${src}" alt="${alt}">`;
    }
    default:
      // Unknown / disallowed node: keep the readable children, drop the wrapper.
      return renderChildren(node, depth);
  }
}

/** `null` for an absent or empty document. */
export function renderInstructionsHtml(doc: TiptapDoc | null | undefined): string | null {
  if (doc === null || doc === undefined || doc.type !== "doc") return null;
  const html = (doc.content ?? []).map((node) => renderNode(node, 1)).join("");
  return html.length === 0 ? null : html;
}
