/**
 * Media domain types — docs/05 §2 T-media, docs/06 API-CAT-06/21, §3.5 (presigned flows),
 * docs/09 TM-12 (MIME allow-list, size caps), A-1202.
 */
import type { mediaKind, mediaVisibility } from "../../../drizzle/schema/media";
import { maxBytesForMime, mimesOf, SVG_MIME } from "@/lib/upload-formats";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIMES as CHAT_ATTACHMENT_MIMES } from "@/lib/attachments";
import { enumTuple } from "../catalog/types";

export type { Media } from "../../../drizzle/schema/media";
export type { FilesUploadIntent } from "../../../drizzle/schema/ops";

export type MediaKindValue = (typeof mediaKind.enumValues)[number];
export const MEDIA_KINDS = enumTuple<MediaKindValue>()([
  "image",
  "screenshot",
  "gallery",
  "video_embed",
  "video_file",
  "presentation",
  "attachment",
  "og",
] as const);

/** Kinds that need `alt` (1..125) and a `public` media object (API-CAT-06). */
export const IMAGE_MEDIA_KINDS: readonly MediaKindValue[] = [
  "image",
  "screenshot",
  "gallery",
  "og",
];

export type MediaVisibilityValue = (typeof mediaVisibility.enumValues)[number];
export const MEDIA_VISIBILITIES = enumTuple<MediaVisibilityValue>()(["public", "private"] as const);

/** docs/06 §3.5 upload purposes. */
export const UPLOAD_PURPOSES = [
  "product_image",
  "product_screenshot",
  "product_video",
  "product_presentation",
  "product_attachment",
  "release_file",
  "content_media",
  "expense_receipt",
  "query_attachment",
  "chat_attachment",
  "avatar",
  "site_logo",
  "payment_qr",
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

/** Purposes a customer session may use (`media.upload` not required). */
export const CUSTOMER_UPLOAD_PURPOSES: readonly UploadPurpose[] = [
  "query_attachment",
  "chat_attachment",
  "avatar",
];

const MB = 1024 * 1024;
// The format lists live in one shared constant (src/lib/upload-formats.ts).
export const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;
export const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const AUDIO_MIMES: readonly string[] = mimesOf("audio");
export const OFFICE_MIMES: readonly string[] = mimesOf("office");
export const TEXT_MIMES: readonly string[] = mimesOf("text");
export const FONT_MIMES: readonly string[] = mimesOf("font");
export const PDF_MIMES = ["application/pdf"] as const;
export const ARCHIVE_MIMES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-tar",
  "application/x-7z-compressed",
] as const;
/** Installer MIMEs browsers report for .exe/.msi/.dmg/.pkg/.deb/.rpm/.AppImage; octet-stream is the fallback for empty types. */
export const INSTALLER_MIMES = [
  "application/octet-stream",
  "application/x-msdownload",
  "application/vnd.microsoft.portable-executable",
  "application/x-dosexec",
  "application/x-msi",
  "application/x-apple-diskimage",
  "application/x-newton-compatible-pkg",
  "application/vnd.debian.binary-package",
  "application/x-debian-package",
  "application/x-rpm",
  "application/x-iso9660-image",
] as const;
export const ATTACHMENT_MIMES = [
  ...IMAGE_MIMES,
  ...PDF_MIMES,
  ...ARCHIVE_MIMES,
  "text/plain",
  "text/csv",
] as const;

export interface UploadRule {
  mimes: readonly string[];
  maxBytes: number;
  visibility: MediaVisibilityValue;
}

/** Per-purpose allow-list and cap (docs/06 §3.5, A-1402, FR-CONT-06). SVG is accepted for content_media only (TM-12). */
export const UPLOAD_RULES: Readonly<Record<UploadPurpose, UploadRule>> = Object.freeze({
  product_image: { mimes: IMAGE_MIMES, maxBytes: 10 * MB, visibility: "public" },
  product_screenshot: { mimes: IMAGE_MIMES, maxBytes: 10 * MB, visibility: "public" },
  product_video: { mimes: VIDEO_MIMES, maxBytes: 200 * MB, visibility: "public" },
  product_presentation: { mimes: PDF_MIMES, maxBytes: 25 * MB, visibility: "private" },
  product_attachment: {
    mimes: [...ATTACHMENT_MIMES, ...OFFICE_MIMES, "application/json"],
    maxBytes: 20 * MB,
    visibility: "private",
  },
  release_file: {
    mimes: [...ARCHIVE_MIMES, ...INSTALLER_MIMES],
    maxBytes: 2048 * MB,
    visibility: "private",
  },
  // Landing pages, blog, case studies, logos: every common web format (see upload-formats.ts).
  // SVG is allowed here only, and only after the safety check in svg-safety.ts.
  content_media: {
    mimes: [
      ...IMAGE_MIMES,
      SVG_MIME,
      ...VIDEO_MIMES,
      ...AUDIO_MIMES,
      ...PDF_MIMES,
      ...OFFICE_MIMES,
      ...ARCHIVE_MIMES,
      ...TEXT_MIMES,
      ...FONT_MIMES,
    ],
    maxBytes: 200 * MB,
    visibility: "public",
  },
  expense_receipt: {
    mimes: [...IMAGE_MIMES, ...PDF_MIMES],
    maxBytes: 25 * MB,
    visibility: "private",
  },
  query_attachment: { mimes: ATTACHMENT_MIMES, maxBytes: 20 * MB, visibility: "private" },
  // P14-06: chat + query thread attachments (customer and admin); private, served by an authorised route.
  chat_attachment: {
    mimes: CHAT_ATTACHMENT_MIMES,
    maxBytes: ATTACHMENT_MAX_BYTES,
    visibility: "private",
  },
  avatar: { mimes: IMAGE_MIMES, maxBytes: 10 * MB, visibility: "public" },
  // PNG/JPEG only: SVG is never accepted (TM-12) and the invoice PDF cannot embed WebP.
  site_logo: {
    mimes: ["image/png", "image/jpeg"],
    maxBytes: 2 * MB,
    visibility: "public",
  },
  // Manual-payment UPI QR: stored in the public bucket, the setting keeps only its URL (never a DB blob).
  payment_qr: {
    mimes: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: 1 * MB,
    visibility: "public",
  },
});

/** Effective size cap: the purpose cap, tightened by the format's own cap (images 10 MB, SVG 1 MB...). Release files keep their purpose cap (big installers/archives). */
export function maxBytesFor(purpose: UploadPurpose, mime: string): number {
  const purposeCap = UPLOAD_RULES[purpose].maxBytes;
  const formatCap = maxBytesForMime(mime);
  return purpose === "release_file" || formatCap === 0
    ? purposeCap
    : Math.min(purposeCap, formatCap);
}

/** Embed hosts accepted for `video_embed` (API-CAT-06). */
export const EMBED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
] as const;

export const UPLOAD_INTENT_TTL_MS = 15 * 60 * 1000;
export const PRESIGNED_GET_TTL_MS = 5 * 60 * 1000;

/** API-CAT-31 / API-CAT-19 media block. */
export interface ProductMediaView {
  id: string;
  kind: MediaKindValue;
  mediaId: string | null;
  /** Public URL, signed URL (`presentation`, 5 min) or the embed URL. */
  url: string;
  embedUrl: string | null;
  title: string | null;
  alt: string;
  position: number;
  mime: string | null;
  width: number | null;
  height: number | null;
  blurHash: string | null;
}
