/**
 * Upload validation beyond the Zod schema (PHASE-03 P3.5; docs/06 §3.5, docs/09 TM-12, SA-13):
 * server-chosen object keys, extension ↔ MIME agreement, and the never-accepted extensions
 * (`.svg`, `.html`, `.js`, executables) regardless of the declared MIME type.
 */
import { AppError, ErrorCode } from "@/lib/errors";
import {
  type MediaVisibilityValue,
  UPLOAD_RULES,
  type UploadPurpose,
  type UploadRule,
} from "./types";

/** Canonical extension per accepted MIME (the object key always uses this one). */
export const EXTENSION_BY_MIME: Readonly<Record<string, string>> = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/gzip": "gz",
  "application/x-tar": "tar",
  "application/x-7z-compressed": "7z",
  "text/plain": "txt",
  "text/csv": "csv",
});

/** Filename extensions accepted for a MIME (the canonical one plus common aliases). */
export const EXTENSION_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "image/jpeg": ["jpg", "jpeg", "jpe"],
  "application/gzip": ["gz", "tgz", "gzip"],
  "text/plain": ["txt", "text", "log", "md"],
});

/** Never stored, whatever the MIME says (TM-12, SA-13). */
export const FORBIDDEN_EXTENSIONS: readonly string[] = Object.freeze([
  "svg",
  "svgz",
  "html",
  "htm",
  "xhtml",
  "shtml",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "exe",
  "dll",
  "com",
  "scr",
  "msi",
  "bat",
  "cmd",
  "ps1",
  "sh",
  "bash",
  "php",
  "jar",
  "vbs",
  "wsf",
  "app",
  "dmg",
]);

export interface ValidatedUpload {
  purpose: UploadPurpose;
  mime: string;
  ext: string;
  visibility: MediaVisibilityValue;
  rule: UploadRule;
}

function validation(field: string, message: string): AppError {
  return new AppError(ErrorCode.VALIDATION, message, { fieldErrors: { [field]: [message] } });
}

export function extensionOf(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return null;
  return filename.slice(dot + 1).toLowerCase();
}

export function normaliseMime(mime: string): string {
  return mime.split(";")[0]?.trim().toLowerCase() ?? "";
}

/**
 * Re-check the schema rules (defence in depth) and add the extension rules. Throws
 * `VALIDATION` with `fieldErrors` on the offending field.
 */
export function validateUploadRequest(input: {
  purpose: UploadPurpose;
  filename: string;
  mime: string;
  sizeBytes: number;
}): ValidatedUpload {
  const rule = UPLOAD_RULES[input.purpose];
  const mime = normaliseMime(input.mime);
  if (!rule.mimes.includes(mime)) throw validation("mime", "mime not allowed for this purpose");
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1) {
    throw validation("sizeBytes", "sizeBytes must be a positive integer");
  }
  if (input.sizeBytes > rule.maxBytes) {
    throw validation("sizeBytes", "file exceeds the size cap for this purpose");
  }
  const ext = extensionOf(input.filename);
  if (ext !== null && FORBIDDEN_EXTENSIONS.includes(ext)) {
    throw validation("filename", `.${ext} files are never accepted`);
  }
  const canonical = EXTENSION_BY_MIME[mime];
  if (canonical === undefined) throw validation("mime", "unsupported mime");
  const accepted = [canonical, ...(EXTENSION_ALIASES[mime] ?? [])];
  if (ext !== null && !accepted.includes(ext)) {
    throw validation("filename", `extension .${ext} does not match ${mime}`);
  }
  return { purpose: input.purpose, mime, ext: canonical, visibility: rule.visibility, rule };
}

/** `media/<yyyy>/<mm>/<uuid>.<ext>` (docs/12 §6). */
export function objectKeyFor(now: Date, id: string, ext: string): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `media/${yyyy}/${mm}/${id}.${ext}`;
}
