"use client";

import {
  BoldIcon,
  CodeIcon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  TableIcon,
} from "lucide-react";
import * as React from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";

const TOOLS = [
  { label: "Heading 2", Icon: Heading2Icon },
  { label: "Heading 3", Icon: Heading3Icon },
  { label: "Bold", Icon: BoldIcon },
  { label: "Italic", Icon: ItalicIcon },
  { label: "Bulleted list", Icon: ListIcon },
  { label: "Numbered list", Icon: ListOrderedIcon },
  { label: "Link", Icon: LinkIcon },
  { label: "Image", Icon: ImageIcon },
  { label: "Code", Icon: CodeIcon },
  { label: "Quote", Icon: QuoteIcon },
  { label: "Table", Icon: TableIcon },
] as const;

/**
 * Rich-text placeholder — docs/07 §4.7 names Tiptap (headings 2–3, bold, italic, lists, link,
 * image, code, quote, table). Until Tiptap arrives (P3) this renders the toolbar shape and a
 * textarea so the editors can be previewed; the API (`value`/`onChange`) stays the same.
 */
export function RichTextField({
  id,
  label,
  required,
  hint,
  defaultValue,
  rows = 6,
  full = false,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
  rows?: number;
  /** Full toolbar (legal pages); otherwise the "lite" set without image/table. */
  full?: boolean;
  className?: string;
}) {
  const tools = full
    ? TOOLS
    : TOOLS.filter((t) => t.label !== "Image" && t.label !== "Table" && t.label !== "Code");
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <div className="rounded-md border border-border-strong bg-surface focus-within:border-accent">
        <div
          role="toolbar"
          aria-label={`${label} formatting`}
          className="flex flex-wrap gap-0.5 border-b border-border p-1"
        >
          {tools.map(({ label: tl, Icon }) => (
            <button
              key={tl}
              type="button"
              aria-label={tl}
              className="grid size-8 place-items-center rounded-sm text-fg-muted hover:bg-accent-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Icon aria-hidden className="size-4" />
            </button>
          ))}
          <span className="ml-auto self-center px-2 text-caption text-fg-subtle">
            Tiptap arrives in P3
          </span>
        </div>
        <Textarea
          id={id}
          rows={rows}
          defaultValue={defaultValue}
          required={required}
          aria-required={required}
          className="min-h-0 rounded-t-none border-0 focus-visible:outline-0"
        />
      </div>
      {hint ? <p className="text-caption text-fg-muted">{hint}</p> : null}
    </div>
  );
}

/** Labelled field wrapper for plain inputs. */
export function Field({
  id,
  label,
  required,
  optional,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
        {optional ? <span className="font-normal text-fg-muted">(optional)</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
