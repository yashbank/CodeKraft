/**
 * Media contracts — docs/06 API-CAT-06 (`attachProductMedia` / `reorderProductMedia` /
 * `detachProductMedia`), API-CAT-21 + §3.5 (`createUploadIntent`, `completeUpload`, private
 * media links), docs/09 TM-12.
 */
import { z } from "zod";
import type { Context, RequestContext } from "@/lib/authz/context";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { uuidSchema } from "@/modules/_shared/zod";
import { positionSchema, text } from "../catalog/contracts";
import {
  EMBED_HOSTS,
  IMAGE_MEDIA_KINDS,
  MEDIA_KINDS,
  UPLOAD_PURPOSES,
  UPLOAD_RULES,
  type Media,
  type MediaVisibilityValue,
  type ProductMediaView,
  type UploadPurpose,
} from "./types";

export const mediaKindSchema = z.enum(MEDIA_KINDS);
export const uploadPurposeSchema = z.enum(UPLOAD_PURPOSES);

/** Embed URL restricted to the youtube/vimeo allow-list (API-CAT-06). */
export const embedUrlSchema = z
  .url({ protocol: /^https$/ })
  .max(2048)
  .refine((u) => (EMBED_HOSTS as readonly string[]).includes(new URL(u).hostname), {
    message: "embed host must be youtube or vimeo",
  });

/** `alt` is mandatory (1..125) for image kinds; optional otherwise. */
export const altTextSchema = z.string().trim().max(125);

/** API-CAT-06 `attachProductMedia`. */
export const attachProductMediaSchema = z
  .strictObject({
    productId: uuidSchema,
    kind: mediaKindSchema,
    mediaId: uuidSchema.optional(),
    embedUrl: embedUrlSchema.optional(),
    title: text(120).optional(),
    alt: altTextSchema.default(""),
    position: positionSchema,
  })
  .refine(
    (m) =>
      m.kind === "video_embed"
        ? m.embedUrl !== undefined && m.mediaId === undefined
        : m.mediaId !== undefined && m.embedUrl === undefined,
    {
      message: "video_embed needs embedUrl; every other kind needs mediaId",
      path: ["mediaId"],
    },
  )
  .refine((m) => !IMAGE_MEDIA_KINDS.includes(m.kind) || m.alt.length >= 1, {
    message: "alt text is required for image kinds",
    path: ["alt"],
  });
export type AttachProductMediaInput = z.infer<typeof attachProductMediaSchema>;

/** API-CAT-06 `reorderProductMedia` — full ordered list of `product_media.id`. */
export const reorderProductMediaSchema = z.strictObject({
  productId: uuidSchema,
  productMediaIds: z.array(uuidSchema).min(1).max(200),
});
/** API-CAT-06 `detachProductMedia`. */
export const detachProductMediaSchema = z.strictObject({
  productId: uuidSchema,
  productMediaId: uuidSchema,
});

const filenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((f) => !/[/\\\0]/.test(f) && f !== "." && f !== "..", { message: "invalid filename" });
const mimeSchema = z
  .string()
  .trim()
  .max(127)
  .regex(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i);

/** API-CAT-21 / §3.5 `POST /api/files/upload-intent`. MIME and size are checked per purpose. */
export const createUploadIntentSchema = z
  .strictObject({
    purpose: uploadPurposeSchema,
    filename: filenameSchema,
    mime: mimeSchema,
    sizeBytes: z.number().int().min(1),
    checksumSha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/i)
      .optional(),
  })
  .refine((i) => UPLOAD_RULES[i.purpose].mimes.includes(i.mime.toLowerCase()), {
    message: "mime not allowed for this purpose",
    path: ["mime"],
  })
  .refine((i) => i.sizeBytes <= UPLOAD_RULES[i.purpose].maxBytes, {
    message: "file exceeds the size cap for this purpose",
    path: ["sizeBytes"],
  });
export type CreateUploadIntentInput = z.infer<typeof createUploadIntentSchema>;

export interface UploadIntentResult {
  intentId: string;
  /** Presigned PUT, 15 min. */
  uploadUrl: string;
  objectKey: string;
  headers: { "Content-Type": string };
  visibility: MediaVisibilityValue;
}

/** §3.5 `POST /api/files/upload-intent/<intentId>/complete`. */
export const completeUploadSchema = z.strictObject({ intentId: uuidSchema });
export interface CompleteUploadResult {
  mediaId: string;
  /** Public URL only for `public` objects. */
  url?: string;
}

/** §3.5 `GET /api/files/private/[mediaId]` (admin, audited). */
export const privateMediaLinkSchema = z.strictObject({ mediaId: uuidSchema });

export const MEDIA_CACHE_TAGS = {
  attachProductMedia: ["catalog"],
  reorderProductMedia: ["catalog"],
  detachProductMedia: ["catalog"],
} as const satisfies Record<string, readonly string[]>;

export interface MediaService {
  /** API-CAT-06 — visibility must match the kind (`public` for image kinds, `private` for `attachment`). */
  attachProductMedia(
    ctx: RequestContext,
    input: AttachProductMediaInput,
    tx?: DbOrTx,
  ): Promise<{ productMedia: ProductMediaView[] }>;
  /** API-CAT-06 */
  reorderProductMedia(
    ctx: RequestContext,
    input: z.infer<typeof reorderProductMediaSchema>,
    tx?: DbOrTx,
  ): Promise<{ productMedia: ProductMediaView[] }>;
  /** API-CAT-06 */
  detachProductMedia(
    ctx: RequestContext,
    input: z.infer<typeof detachProductMediaSchema>,
    tx?: DbOrTx,
  ): Promise<{ productMedia: ProductMediaView[] }>;
  /** API-CAT-21 / §3.5 — admin `media.upload`, or customer for `query_attachment` / `avatar`. */
  createUploadIntent(
    ctx: RequestContext,
    input: CreateUploadIntentInput,
    tx?: DbOrTx,
  ): Promise<UploadIntentResult>;
  /** §3.5 complete — HEADs the object, verifies size/mime/checksum, inserts `media`, marks the intent consumed. */
  completeUpload(
    ctx: RequestContext,
    input: z.infer<typeof completeUploadSchema>,
    tx?: DbOrTx,
  ): Promise<CompleteUploadResult>;
  /** §3.5 private link — 5-minute presigned GET for `private` media; audited. */
  getPrivateMediaUrl(
    ctx: RequestContext,
    input: z.infer<typeof privateMediaLinkSchema>,
    tx?: DbOrTx,
  ): Promise<{ url: string; expiresAt: string }>;
  /** Public/signed URL resolver used by catalog and content view builders (never bytes). */
  urlFor(
    media: Pick<Media, "id" | "bucket" | "objectKey" | "visibility">,
    purpose?: UploadPurpose,
  ): Promise<string>;
  /** API-CAT-15 delete apply: remove private objects from storage after the product graph is gone. */
  deleteObjects(ctx: Context, mediaIds: readonly string[], tx: TxCtx): Promise<void>;
}
