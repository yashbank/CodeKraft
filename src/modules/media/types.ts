/**
 * Media domain types — docs/05 §2 T-media, docs/06 API-CAT-06/21, §3.5 (presigned flows),
 * docs/09 TM-12 (MIME allow-list, size caps), A-1202.
 */
import type { mediaKind, mediaVisibility } from "../../../drizzle/schema/media";
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
  "avatar",
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

/** Purposes a customer session may use (`media.upload` not required). */
export const CUSTOMER_UPLOAD_PURPOSES: readonly UploadPurpose[] = ["query_attachment", "avatar"];

const MB = 1024 * 1024;
export const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;
export const VIDEO_MIMES = ["video/mp4", "video/webm"] as const;
export const PDF_MIMES = ["application/pdf"] as const;
export const ARCHIVE_MIMES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-tar",
  "application/x-7z-compressed",
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

/** Per-purpose allow-list and cap (docs/06 §3.5, A-1402, FR-CONT-06). SVG is never accepted (TM-12). */
export const UPLOAD_RULES: Readonly<Record<UploadPurpose, UploadRule>> = Object.freeze({
  product_image: { mimes: IMAGE_MIMES, maxBytes: 10 * MB, visibility: "public" },
  product_screenshot: { mimes: IMAGE_MIMES, maxBytes: 10 * MB, visibility: "public" },
  product_video: { mimes: VIDEO_MIMES, maxBytes: 200 * MB, visibility: "public" },
  product_presentation: { mimes: PDF_MIMES, maxBytes: 25 * MB, visibility: "private" },
  product_attachment: { mimes: ATTACHMENT_MIMES, maxBytes: 20 * MB, visibility: "private" },
  release_file: { mimes: ARCHIVE_MIMES, maxBytes: 2048 * MB, visibility: "private" },
  content_media: {
    mimes: [...IMAGE_MIMES, ...VIDEO_MIMES],
    maxBytes: 200 * MB,
    visibility: "public",
  },
  expense_receipt: {
    mimes: [...IMAGE_MIMES, ...PDF_MIMES],
    maxBytes: 25 * MB,
    visibility: "private",
  },
  query_attachment: { mimes: ATTACHMENT_MIMES, maxBytes: 20 * MB, visibility: "private" },
  avatar: { mimes: IMAGE_MIMES, maxBytes: 10 * MB, visibility: "public" },
});

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
