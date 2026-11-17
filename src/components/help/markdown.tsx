import * as React from "react";
import Link from "next/link";

import { safePath } from "./paths";

/** Markdown-lite: paragraphs, numbered/bullet lists, **bold**, `code`, [label](/internal). Never raw HTML. */
type Block = { t: "p"; text: string } | { t: "ol" | "ul"; items: string[] };

export function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const m = ol ?? ul;
    if (!line) flush();
    else if (m) {
      flush();
      const kind = ol ? "ol" : "ul";
      const last = blocks[blocks.length - 1];
      if (last && last.t === kind) last.items.push(m[1] ?? "");
      else blocks.push({ t: kind, items: [m[1] ?? ""] });
    } else para.push(line);
  }
  flush();
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, keyBase: string): React.ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return (
        <strong key={key} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code key={key} className="rounded bg-elevated px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safePath(link[2]);
      // External links (and anything that is not a same-site path) are reduced to their label.
      return href ? (
        <Link key={key} href={href} className="text-accent-text underline underline-offset-2">
          {link[1]}
        </Link>
      ) : (
        <React.Fragment key={key}>{link[1]}</React.Fragment>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function HelpMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-2 text-body-sm leading-relaxed text-fg">
      {blocks.map((b, i) =>
        b.t === "p" ? (
          <p key={i}>{inline(b.text, `p${i}`)}</p>
        ) : b.t === "ol" ? (
          <ol key={i} className="space-y-1.5">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-text"
                >
                  {j + 1}
                </span>
                <span className="min-w-0">{inline(it, `o${i}-${j}`)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="space-y-1">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-text" />
                <span className="min-w-0">{inline(it, `u${i}-${j}`)}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/** Plain text for the copy button (markers removed, links reduced to labels). */
export function toPlainText(src: string): string {
  return src
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}
