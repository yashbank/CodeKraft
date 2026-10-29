/**
 * Chat + support-query attachments (P14-06): client-safe limits and validation. Server code
 * re-checks everything (media upload-intent purpose `chat_attachment`, send/reply paths).
 */
export const ATTACHMENT_MAX_FILES = 5;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Allow-list: extension -> canonical MIME. SVG/HTML/executables are never accepted. */
export const ATTACHMENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});
export const ATTACHMENT_MIMES: readonly string[] = [...new Set(Object.values(ATTACHMENT_TYPES))];
export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((e) => `.${e}`)
  .join(",");
export const ATTACHMENT_TYPES_LABEL = "PNG, JPG, WebP, GIF, PDF, TXT, MD, CSV, DOCX";

/** Shape every thread/transcript renders. */
export interface AttachmentView {
  mediaId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  /** Authorised same-origin route; add `?download=1` to force a download. */
  url: string;
}

export const attachmentUrl = (mediaId: string) => `/api/files/attachment/${mediaId}`;
export const isImageMime = (mime: string) => mime.startsWith("image/");

const ext = (name: string) =>
  name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";

/** Canonical MIME for a filename (browsers send "" / wrong types for md, csv). */
export function mimeForFilename(name: string): string | null {
  return ATTACHMENT_TYPES[ext(name)] ?? null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Browsers report generic/legacy types for text-like files; the server sniffs the bytes anyway. */
function isLooseMime(mime: string, canonical: string): boolean {
  const m = mime.toLowerCase();
  if (m === "" || m === "application/octet-stream") return true;
  if (canonical === "text/csv") return m === "application/vnd.ms-excel" || m === "text/plain";
  if (canonical === "text/markdown") return m === "text/x-markdown" || m === "text/plain";
  return false;
}

/** Returns a user-facing error, or null when the file is acceptable. */
export function validateAttachmentFile(f: {
  name: string;
  size: number;
  mime?: string;
}): string | null {
  const canonical = mimeForFilename(f.name);
  if (!canonical)
    return `${f.name}: this file type is not allowed. Allowed: ${ATTACHMENT_TYPES_LABEL}.`;
  if (f.mime && f.mime.toLowerCase() !== canonical && !isLooseMime(f.mime, canonical))
    return `${f.name}: file content type does not match its extension.`;
  if (f.size <= 0) return `${f.name}: the file is empty.`;
  if (f.size > ATTACHMENT_MAX_BYTES)
    return `${f.name}: larger than ${formatBytes(ATTACHMENT_MAX_BYTES)}.`;
  return null;
}

export function validateAttachmentCount(n: number): string | null {
  return n > ATTACHMENT_MAX_FILES ? `You can attach up to ${ATTACHMENT_MAX_FILES} files.` : null;
}
