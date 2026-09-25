"use client";

import * as React from "react";
import { ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/_utils";
import { PageHeader } from "../PageHeader";

export interface RailItem {
  key: string;
  label: string;
  meta?: string;
  badge?: React.ReactNode;
}

/**
 * Shared frame for the content editors (SCR-ADM-23…28): page header, optional left rail with
 * `aria-current`, the form column (max 800–880 px), an optional right panel and a sticky save
 * bar with "Saved n s ago" / Save / Discard (docs/07 §4.7 autosave + unsaved guard).
 */
export function ContentEditorFrame({
  title,
  description,
  rail,
  railLabel,
  active,
  onSelect,
  previewHref,
  savedAgoSeconds = 20,
  panel,
  headerActions,
  children,
  saveLabel = "Save",
  onSave,
  wide = false,
}: {
  title: string;
  description?: string;
  rail?: RailItem[];
  railLabel?: string;
  active?: string;
  onSelect?: (key: string) => void;
  previewHref?: string;
  savedAgoSeconds?: number;
  panel?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  saveLabel?: string;
  onSave?: () => void;
  wide?: boolean;
}) {
  const [dirty, setDirty] = React.useState(false);
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {headerActions}
            {previewHref ? (
              <Button asChild variant="outline" size="sm">
                <a href={previewHref} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon aria-hidden /> Preview{" "}
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </Button>
            ) : null}
          </>
        }
      />
      <div
        className={cn(
          "grid gap-6",
          rail && panel
            ? "lg:grid-cols-[2fr_7fr_3fr]"
            : rail
              ? "lg:grid-cols-[240px_1fr]"
              : panel
                ? "lg:grid-cols-[1fr_360px]"
                : "",
        )}
      >
        {rail ? (
          <nav
            aria-label={railLabel ?? "Sections"}
            className="rounded-lg border border-border bg-surface p-2"
          >
            <ul className="space-y-0.5">
              {rail.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(item.key)}
                    aria-current={item.key === active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-body-sm hover:bg-accent-soft",
                      item.key === active && "bg-accent-soft font-medium text-accent-text",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{item.label}</span>
                      {item.meta ? (
                        <span className="block truncate text-caption text-fg-muted">
                          {item.meta}
                        </span>
                      ) : null}
                    </span>
                    {item.badge}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div
          className={cn("min-w-0", wide ? "max-w-[960px]" : "max-w-[880px]")}
          onChangeCapture={() => setDirty(true)}
        >
          {children}
        </div>
        {panel ? <aside className="space-y-4">{panel}</aside> : null}
      </div>
      <div className="sticky bottom-0 mt-6 -mx-4 flex items-center gap-3 border-t border-border bg-canvas px-4 py-3 lg:-mx-6 lg:px-6">
        <span className="text-caption text-fg-muted" aria-live="polite">
          {dirty ? "Unsaved changes" : `Saved ${savedAgoSeconds} s ago`}
        </span>
        <span className="ml-auto flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!dirty}
            onClick={() => {
              setDirty(false);
              toast("Changes discarded");
            }}
          >
            Discard
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setDirty(false);
              (onSave ?? (() => toast.success("Saved")))();
            }}
          >
            {saveLabel}
          </Button>
        </span>
      </div>
    </>
  );
}

/** Sortable list row with drag handle and keyboard move buttons (dnd arrives with Phase 8). */
export function SortableRow({
  index,
  total,
  label,
  onMove,
  children,
  className,
}: {
  index: number;
  total: number;
  label: string;
  onMove: (from: number, to: number) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-surface p-3",
        className,
      )}
    >
      <span aria-hidden className="cursor-grab text-fg-subtle">
        ⋮⋮
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${label} up`}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
        >
          ↑
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${label} down`}
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
        >
          ↓
        </Button>
      </div>
    </li>
  );
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}
