"use client";

import { DownloadIcon, FileArchiveIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "../EmptyState";
import { formatDate } from "../format";
import type { ChangelogEntry, ReleaseFile } from "../types";

/**
 * Download panel (SCR-ACC-03): release files allowed by the update policy, "N of M downloads
 * left" counter (BR-15), signed-link button ("Preparing…" then the download opens, docs/07 §4.14),
 * cap reached → disabled + "Ask us to reset"; changelog accordion.
 */
export function DownloadPanel({
  files,
  changelog = [],
  downloadsUsed,
  downloadsCap,
  onDownload,
  queryHref,
}: {
  files: ReleaseFile[];
  changelog?: ChangelogEntry[];
  downloadsUsed: number;
  downloadsCap: number;
  onDownload?: (file: ReleaseFile) => Promise<void> | void;
  queryHref: string;
}) {
  const [used, setUsed] = React.useState(downloadsUsed);
  const [preparing, setPreparing] = React.useState<string | null>(null);
  const left = Math.max(downloadsCap - used, 0);
  const capped = left === 0;

  async function download(file: ReleaseFile) {
    setPreparing(file.id);
    try {
      await onDownload?.(file);
      await new Promise((r) => setTimeout(r, 600));
      const next = Math.min(used + 1, downloadsCap);
      setUsed(next);
      toast.success("Download started", { description: `${downloadsCap - next} left` });
    } finally {
      setPreparing(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3 text-fg">Files</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge tone={capped ? "danger" : left <= 1 ? "warning" : "accent"} tabIndex={0}>
                {left} of {downloadsCap} downloads left
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              Each purchase includes {downloadsCap} downloads across all versions.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {capped ? (
        <div
          role="status"
          className="rounded-md border-l-4 border-warning bg-warning-soft p-4 text-body-sm text-warning"
        >
          <p className="font-semibold">You&apos;ve used all {downloadsCap} downloads.</p>
          <p className="text-fg">
            Ask us to reset the counter and we&apos;ll sort it within a working day.{" "}
            <a href={queryHref} className="font-medium text-accent-text underline">
              Ask us to reset
            </a>
          </p>
        </div>
      ) : null}

      {files.length === 0 ? (
        <EmptyState
          icon={FileArchiveIcon}
          title="No files released yet"
          body="We'll notify you when the first release is ready."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {files.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <FileArchiveIcon
                aria-hidden
                className="hidden size-5 shrink-0 text-fg-subtle sm:block"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-body-sm text-fg">{f.name}</p>
                <p className="text-caption text-fg-muted">
                  v{f.version} · {f.sizeLabel} · released {formatDate(f.releasedAt)}
                </p>
              </div>
              <Button
                size="sm"
                variant={f === files[0] ? "primary" : "secondary"}
                disabled={capped}
                loading={preparing === f.id}
                onClick={() => download(f)}
                className="w-full sm:w-auto"
              >
                <DownloadIcon aria-hidden />
                {preparing === f.id ? "Preparing…" : "Download"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {changelog.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          className="rounded-lg border border-border bg-surface px-4"
        >
          <AccordionItem value="changelog" className="border-b-0">
            <AccordionTrigger className="text-body font-semibold">Changelog</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-3">
                {changelog.map((c) => (
                  <li key={c.version}>
                    <p className="text-body-sm font-semibold text-fg">
                      v{c.version}{" "}
                      <span className="font-normal text-fg-muted">· {formatDate(c.date)}</span>
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-body-sm text-fg-muted">
                      {c.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}
