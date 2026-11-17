"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRightIcon, LightbulbIcon } from "lucide-react";

import { cn } from "@/components/ui/_utils";
import { inline, parseBlocks } from "./markdown";
import { linkHref } from "./paths";
import type { HelpStrings } from "./strings";
import type { HelpLink, HelpMode } from "./types";

const TIP = /^(?:tip|note|सुझाव)\s*[:\-–]\s*/i;

export interface RichParts {
  summary: string | null;
  rest: ReturnType<typeof parseBlocks>;
  tip: string | null;
}

/** Split an answer into: one-line summary, body blocks (steps/bullets/paragraphs) and a trailing tip. */
export function splitAnswer(text: string, mode: HelpMode, fallbackSummary?: string): RichParts {
  const blocks = parseBlocks(text);
  let summary: string | null = null;
  let tip: string | null = null;
  if (mode === "search") return { summary: null, rest: blocks, tip: null };

  const first = blocks[0];
  if (first?.t === "p") {
    const hasMore = blocks.length > 1;
    const m = /^(.+?[.!?:])(\s+[\s\S]+)$/.exec(first.text);
    if (!hasMore && m && first.text.length > 140) {
      summary = m[1] ?? null;
      blocks[0] = { t: "p", text: (m[2] ?? "").trim() };
    } else if (first.text.length <= 160 || !m) {
      summary = first.text;
      blocks.shift();
    } else {
      summary = m[1] ?? null;
      blocks[0] = { t: "p", text: (m[2] ?? "").trim() };
    }
  } else if (first && fallbackSummary) summary = fallbackSummary;

  const last = blocks[blocks.length - 1];
  const afterList = blocks.slice(0, -1).some((b) => b.t === "ol" || b.t === "ul");
  if (last?.t === "p" && (afterList || TIP.test(last.text))) {
    tip = last.text.replace(TIP, "");
    blocks.pop();
  }
  return { summary, rest: blocks, tip };
}

const BTN =
  "inline-flex min-h-11 max-w-full items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-body-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none motion-reduce:transition-none";

export function RichAnswer({
  text,
  mode,
  title,
  links,
  t,
  onNavigate,
}: {
  text: string;
  mode: HelpMode;
  title?: string;
  links: HelpLink[];
  t: HelpStrings;
  /** Called when a link button is used so the panel can close. */
  onNavigate: () => void;
}) {
  const { summary, rest, tip } = splitAnswer(text, mode, title);
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);
  const resolved = origin
    ? links
        .map((l) => ({
          l,
          href: linkHref(
            l.path,
            origin,
            process.env.NEXT_PUBLIC_ADMIN_URL,
            process.env.NEXT_PUBLIC_SITE_URL,
          ),
        }))
        .filter((x): x is { l: HelpLink; href: string } => x.href !== null)
        .slice(0, 3)
    : [];

  return (
    <div className="space-y-3 text-body-sm leading-relaxed text-fg" data-testid="help-rich">
      {summary ? (
        <p className="font-semibold text-fg [overflow-wrap:anywhere]" data-testid="help-summary">
          {inline(summary, "s")}
        </p>
      ) : null}
      {rest.map((b, i) =>
        b.t === "p" ? (
          <p key={i} className="[overflow-wrap:anywhere]">
            {inline(b.text, `p${i}`)}
          </p>
        ) : b.t === "ol" ? (
          <ol key={i} className="space-y-1.5" aria-label={t.steps} data-testid="help-steps">
            {b.items.map((it, j) => (
              <li
                key={j}
                className="flex gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-2"
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-text"
                >
                  {j + 1}
                </span>
                <span className="min-w-0 [overflow-wrap:anywhere]">{inline(it, `o${i}-${j}`)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="space-y-1">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-text" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{inline(it, `u${i}-${j}`)}</span>
              </li>
            ))}
          </ul>
        ),
      )}
      {tip ? (
        <p
          className="flex items-start gap-2 rounded-lg border border-border bg-accent-soft px-2.5 py-2 text-caption text-fg"
          data-testid="help-tip"
        >
          <LightbulbIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-accent-text" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <strong className="font-semibold text-accent-text">{t.tip}: </strong>
            {inline(tip, "tip")}
          </span>
        </p>
      ) : null}
      {resolved.length ? (
        <div className="flex flex-wrap gap-2 pt-0.5" data-testid="help-links">
          {resolved.map(({ l, href }, i) => {
            const cls = cn(
              BTN,
              i === 0
                ? "bg-accent text-accent-fg hover:bg-accent-hover"
                : "border border-border bg-surface text-fg hover:border-accent hover:text-accent-text",
            );
            const body = (
              <>
                <span className="min-w-0 truncate">
                  {t.open} {l.label}
                </span>
                <ArrowUpRightIcon aria-hidden className="size-4 shrink-0" />
              </>
            );
            return /^https?:/.test(href) ? (
              <a key={l.path} href={href} onClick={onNavigate} className={cls}>
                {body}
              </a>
            ) : (
              <Link key={l.path} href={href} onClick={onNavigate} className={cls}>
                {body}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
