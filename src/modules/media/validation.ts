/**
 * Media validation utilities — docs/09 TM-12, docs/06 API-CAT-06/21, §3.5, SA-13.
 */
import { AppError, ErrorCode } from "@/lib/errors";
import {
  CUSTOMER_UPLOAD_PURPOSES,
  EMBED_HOSTS,
  UPLOAD_PURPOSES,
  UPLOAD_RULES,
  type UploadPurpose,
} from "./types";
import type { CreateUploadIntentInput } from "./contracts";

export const FORBIDDEN_EXTENSIONS = new Set([
  "svg",
  "html",
  "htm",
  "exe",
  "dll",
  "so",
  "dylib",
  "js",
  "mjs",
  "cjs",
  "ts",
  "sh",
  "bash",
  "bat",
  "cmd",
  "vbs",
  "php",
  "phtml",
  "py",
  "rb",
  "jar",
]);

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length <= 1) return "";
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

/**
 * Validate upload intent parameters against per-purpose rules and forbidden extensions.
 */
export function validateUploadIntent(input: CreateUploadIntentInput): void {
  // 1. Check purpose
  if (!UPLOAD_PURPOSES.includes(input.purpose)) {
    throw new AppError(ErrorCode.VALIDATION, `Invalid upload purpose: ${input.purpose}`);
  }

  const rules = UPLOAD_RULES[input.purpose];

  // 2. Disallow forbidden file extensions
  const ext = getFileExtension(input.filename);
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `File extension .${ext} is forbidden for security reasons`,
    );
  }

  // 3. MIME type allow-list
  const normalizedMime = input.mime.toLowerCase().trim();
  if (!rules.mimes.includes(normalizedMime)) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `MIME type '${input.mime}' is not permitted for purpose '${input.purpose}'`,
    );
  }

  // 4. File size limits
  if (input.sizeBytes <= 0) {
    throw new AppError(ErrorCode.VALIDATION, "File size must be greater than 0");
  }

  if (input.sizeBytes > rules.maxBytes) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `File size (${input.sizeBytes} bytes) exceeds maximum allowed (${rules.maxBytes} bytes) for purpose '${input.purpose}'`,
    );
  }
}

/**
 * Validate video embed URL against allowed hostnames.
 */
export function validateEmbedUrl(urlStr: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "Invalid embed URL");
  }

  if (parsed.protocol !== "https:") {
    throw new AppError(ErrorCode.VALIDATION, "Embed URL must use HTTPS");
  }

  const host = parsed.hostname.toLowerCase();
  const isAllowed = (EMBED_HOSTS as readonly string[]).includes(host);
  if (!isAllowed) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `Embed host '${host}' is not allowed. Only YouTube and Vimeo are supported.`,
    );
  }
}

/**
 * Checks whether the given purpose is allowed for standard customer sessions.
 */
export function isCustomerPurpose(purpose: UploadPurpose): boolean {
  return CUSTOMER_UPLOAD_PURPOSES.includes(purpose);
}
