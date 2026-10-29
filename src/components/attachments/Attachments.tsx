"use client";

import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/_utils";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_FILES,
  formatBytes,
  isImageMime,
  mimeForFilename,
  validateAttachmentCount,
  validateAttachmentFile,
  type AttachmentView,
} from "@/lib/attachments";

type Envelope<T> = { ok: true; data: T } | { ok: false; error?: { message?: string } };

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body || !body.ok) {
    throw new Error((body && !body.ok && body.error?.message) || "Upload failed");
  }
  return body.data;
}

/** upload-intent -> PUT to private storage -> complete. Returns the view the thread renders. */
async function uploadAttachment(file: File): Promise<AttachmentView> {
  const mime = mimeForFilename(file.name) ?? file.type;
  const intent = await json<{
    intentId: string;
    uploadUrl: string;
    headers: Record<string, string>;
  }>(
    await fetch("/api/files/upload-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: "chat_attachment",
        filename: file.name,
        mime,
        sizeBytes: file.size,
      }),
    }),
  );
  const put = await fetch(intent.uploadUrl, { method: "PUT", headers: intent.headers, body: file });
  if (!put.ok) throw new Error(`${file.name}: upload failed`);
  const done = await json<{ mediaId: string }>(
    await fetch(`/api/files/upload-intent/${intent.intentId}/complete`, { method: "POST" }),
  );
  return {
    mediaId: done.mediaId,
    name: file.name,
    mime,
    sizeBytes: file.size,
    url: `/api/files/attachment/${done.mediaId}`,
  };
}

/** State for a composer: validated client-side, then uploaded; the server re-checks all of it. */
export function useAttachments() {
  const [items, setItems] = React.useState<AttachmentView[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const add = React.useCallback(
    async (list: FileList | File[]) => {
      const files = Array.from(list);
      setError(null);
      const countErr = validateAttachmentCount(items.length + files.length);
      if (countErr) return setError(countErr);
      for (const f of files) {
        const err = validateAttachmentFile({ name: f.name, size: f.size, mime: f.type });
        if (err) return setError(err);
      }
      setBusy(true);
      try {
        const added: AttachmentView[] = [];
        for (const f of files) added.push(await uploadAttachment(f));
        setItems((prev) => [...prev, ...added]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [items.length],
  );

  return {
    items,
    busy,
    error,
    ids: items.map((i) => i.mediaId),
    add,
    remove: (id: string) => setItems((prev) => prev.filter((i) => i.mediaId !== id)),
    clear: () => {
      setItems([]);
      setError(null);
    },
    setError,
  };
}

/** Paperclip button + hidden file input + removable chips + inline error. */
export function AttachPicker({
  att,
  disabled,
  className,
}: {
  att: ReturnType<typeof useAttachments>;
  disabled?: boolean;
  className?: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <div className={cn("space-y-2", className)}>
      {att.items.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Files to send">
          {att.items.map((a) => (
            <li
              key={a.mediaId}
              className="flex items-center gap-1 rounded-md border border-border bg-canvas px-2 py-1 text-caption text-fg"
            >
              <span className="max-w-40 truncate">{a.name}</span>
              <span className="text-fg-subtle">{formatBytes(a.sizeBytes)}</span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                className="rounded p-0.5 text-fg-muted hover:text-fg"
                onClick={() => att.remove(a.mediaId)}
              >
                <XIcon aria-hidden className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {att.error ? (
        <p role="alert" data-testid="attach-error" className="text-caption text-danger">
          {att.error}
        </p>
      ) : null}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        data-testid="attach-input"
        // Extension allow-list is only a hint; the type check runs in JS and again on the server.
        accept={ATTACHMENT_ACCEPT}
        onChange={(e) => {
          if (e.target.files?.length) void att.add(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || att.busy || att.items.length >= ATTACHMENT_MAX_FILES}
        onClick={() => input.current?.click()}
      >
        <PaperclipIcon aria-hidden /> {att.busy ? "Uploading…" : "Attach"}
      </Button>
    </div>
  );
}

/** Message attachments: image thumbnails (click opens) and file chips (name, size, download). */
export function AttachmentList({
  items,
  className,
}: {
  items: readonly AttachmentView[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Attachments">
      {items.map((a) => (
        <li key={a.mediaId}>
          {isImageMime(a.mime) ? (
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${a.name}`}
              className="block overflow-hidden rounded-md border border-border bg-canvas"
            >
              {/* Authorised same-origin route; next/image would proxy it through the optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="max-h-40 max-w-[12rem] object-cover" />
            </a>
          ) : null}
          <span className="mt-1 flex items-center gap-1 rounded-md border border-border bg-canvas px-2 py-1 text-caption text-fg">
            <FileIcon aria-hidden className="size-3 shrink-0" />
            <span className="max-w-40 truncate">{a.name}</span>
            <span className="text-fg-subtle">{formatBytes(a.sizeBytes)}</span>
            <a
              href={`${a.url}?download=1`}
              download={a.name}
              className="ml-1 text-accent-text hover:underline"
              aria-label={`Download ${a.name}`}
            >
              Download
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
