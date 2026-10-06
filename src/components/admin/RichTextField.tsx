"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";

/**
 * Rich-text placeholder — docs/07 §4.7 names Tiptap. Until Tiptap arrives (P3) this is a plain
 * textarea. The formatting toolbar was removed because its buttons did nothing, so no control
 * claims a format it cannot apply. The API (`name`, `defaultValue`) stays the same, so the Tiptap
 * swap stays inside this file. `full` is still accepted for existing callers; it no longer
 * changes the UI.
 */
export function RichTextField({
  id,
  name,
  label,
  required,
  hint,
  defaultValue,
  rows = 6,
  className,
}: {
  id: string;
  /** Form field name, read via FormData on submit. */
  name?: string;
  label: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
  rows?: number;
  /** Kept for existing callers (full vs lite toolbar); has no effect now that the toolbar is gone. */
  full?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <div className="rounded-md border border-border-strong bg-surface focus-within:border-accent">
        <Textarea
          id={id}
          name={name}
          rows={rows}
          defaultValue={defaultValue}
          required={required}
          aria-required={required}
          className="min-h-0 border-0 focus-visible:outline-0"
        />
      </div>
      <p className="text-caption text-fg-subtle">
        Plain text. Formatting controls arrive with the rich editor (P3).
      </p>
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
