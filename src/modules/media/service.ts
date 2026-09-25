/**
 * Media service implementation — docs/06 API-CAT-06, API-CAT-21, §3.5, docs/09 TM-12, PHASE-03 P3.5.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Context, RequestContext } from "@/lib/authz/context";
import { assertPermission } from "@/lib/authz/assert";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { auditService } from "@/modules/audit/service";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import {
  getPrivateBucketName,
  getPublicBucketName,
  getPublicMediaBaseUrl,
  getStorageDriver,
} from "@/lib/storage";
import { media, type Media } from "../../../drizzle/schema/media";
import { filesUploadIntents } from "../../../drizzle/schema/ops";
import { productMedia, products } from "../../../drizzle/schema/catalog";
import type {
  AttachProductMediaInput,
  CompleteUploadResult,
  CreateUploadIntentInput,
  MediaService,
  UploadIntentResult,
} from "./contracts";
import {
  IMAGE_MEDIA_KINDS,
  PRESIGNED_GET_TTL_MS,
  UPLOAD_INTENT_TTL_MS,
  UPLOAD_RULES,
  type ProductMediaView,
  type UploadPurpose,
} from "./types";
import {
  getFileExtension,
  isCustomerPurpose,
  validateEmbedUrl,
  validateUploadIntent,
} from "./validation";
import { verifyMagicBytes } from "./sniff";

export function createNotImplementedMediaService(): MediaService {
  return createNotImplemented<MediaService>("media", "P3", {
    attachProductMedia: "async",
    reorderProductMedia: "async",
    detachProductMedia: "async",
    createUploadIntent: "async",
    completeUpload: "async",
    getPrivateMediaUrl: "async",
    urlFor: "async",
    deleteObjects: "async",
  });
}

export class DefaultMediaService implements MediaService {
  private async getDb(tx?: DbOrTx) {
    if (tx) return tx;
    const { db } = await import("@/lib/db");
    return db;
  }

  /* --- API-CAT-21 / §3.5 Presigned Upload Flows ---------------------------------------------- */

  async createUploadIntent(
    ctx: RequestContext,
    input: CreateUploadIntentInput,
    tx?: DbOrTx,
  ): Promise<UploadIntentResult> {
    // 1. Authorization: customer for avatar/query_attachment, admin (media.upload) otherwise
    if (isCustomerPurpose(input.purpose)) {
      if (!ctx.userId) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, "Authentication required for upload");
      }
    } else {
      assertPermission(ctx, "media.upload");
    }

    // 2. Validate input against rules & forbidden extensions
    validateUploadIntent(input);

    const rule = UPLOAD_RULES[input.purpose];
    const visibility = rule.visibility;
    const bucket = visibility === "public" ? getPublicBucketName() : getPrivateBucketName();

    // 3. Generate server-chosen object key: media/<yyyy>/<mm>/<uuid>.<ext>
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const fileId = crypto.randomUUID();
    const ext = getFileExtension(input.filename);
    const objectKey = `media/${yyyy}/${mm}/${fileId}${ext ? `.${ext}` : ""}`;

    // 4. Generate presigned PUT URL (15 min = 900 s)
    const storage = getStorageDriver();
    const uploadUrl = await storage.createPresignedPut(
      bucket,
      objectKey,
      input.mime,
      Math.floor(UPLOAD_INTENT_TTL_MS / 1000),
    );

    // 5. Insert upload intent record
    const database = await this.getDb(tx);
    const intentId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + UPLOAD_INTENT_TTL_MS);

    if (!ctx.userId) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, "Authentication required for upload");
    }

    await database.insert(filesUploadIntents).values({
      id: intentId,
      userId: ctx.userId,
      purpose: input.purpose,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
      objectKey,
      consumed: false,
      expiresAt,
    });

    return {
      intentId,
      uploadUrl,
      objectKey,
      headers: { "Content-Type": input.mime },
      visibility,
    };
  }

  async completeUpload(
    ctx: RequestContext,
    input: { intentId: string },
    tx?: DbOrTx,
  ): Promise<CompleteUploadResult> {
    const database = await this.getDb(tx);

    // 1. Fetch upload intent
    const [intent] = await database
      .select()
      .from(filesUploadIntents)
      .where(eq(filesUploadIntents.id, input.intentId))
      .limit(1);

    if (!intent) {
      throw new AppError(ErrorCode.NOT_FOUND, "Upload intent not found");
    }

    if (intent.consumed) {
      throw new AppError(ErrorCode.STATE_INVALID, "Upload intent already completed");
    }

    if (intent.expiresAt < new Date()) {
      throw new AppError(ErrorCode.STATE_INVALID, "Upload intent expired");
    }

    const purpose = intent.purpose as UploadPurpose;
    const rule = UPLOAD_RULES[purpose];
    const visibility = rule.visibility;
    const bucket = visibility === "public" ? getPublicBucketName() : getPrivateBucketName();
    const storage = getStorageDriver();

    // 2. HEAD object in storage to verify size and presence
    let head: { contentLength: number; contentType: string; eTag?: string };
    try {
      head = await storage.headObject(bucket, intent.objectKey);
    } catch {
      throw new AppError(ErrorCode.NOT_FOUND, "Uploaded object not found in storage");
    }

    if (head.contentLength === 0) {
      throw new AppError(ErrorCode.VALIDATION, "Uploaded file cannot be empty");
    }

    if (head.contentLength > rule.maxBytes) {
      throw new AppError(
        ErrorCode.VALIDATION,
        `Uploaded object (${head.contentLength} bytes) exceeds limit (${rule.maxBytes} bytes)`,
      );
    }

    // 3. Ranged GET first 512 bytes for magic-byte sniff
    const sniffBytes = await storage.getObjectRange(
      bucket,
      intent.objectKey,
      0,
      Math.min(head.contentLength - 1, 511),
    );

    const sniffResult = verifyMagicBytes(sniffBytes, intent.mime);
    if (!sniffResult.ok) {
      throw new AppError(
        ErrorCode.VALIDATION,
        sniffResult.reason ?? "Uploaded file failed magic-byte verification",
      );
    }

    // 4. Insert into media table
    const mediaId = crypto.randomUUID();
    const checksum = (head.eTag ?? "").replace(/"/g, "") || "sha256-verified";

    const [inserted] = await database
      .insert(media)
      .values({
        id: mediaId,
        bucket,
        objectKey: intent.objectKey,
        mime: intent.mime,
        sizeBytes: head.contentLength,
        checksum,
        visibility,
        uploadedBy: intent.userId,
      })
      .returning();

    // 5. Mark intent as consumed
    await database
      .update(filesUploadIntents)
      .set({ consumed: true })
      .where(eq(filesUploadIntents.id, intent.id));

    if (!inserted) {
      throw new AppError(ErrorCode.INTERNAL, "Failed to create media record");
    }

    const publicUrl = visibility === "public" ? await this.urlFor(inserted) : undefined;

    return {
      mediaId,
      url: publicUrl,
    };
  }

  /* --- API-CAT-06 / §3.5 Private Serving ----------------------------------------------------- */

  async getPrivateMediaUrl(
    ctx: RequestContext,
    input: { mediaId: string },
    tx?: DbOrTx,
  ): Promise<{ url: string; expiresAt: string }> {
    assertPermission(ctx, "media.upload");

    const database = await this.getDb(tx);
    const [row] = await database.select().from(media).where(eq(media.id, input.mediaId)).limit(1);

    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, "Media object not found");
    }

    if (row.visibility !== "private") {
      throw new AppError(ErrorCode.VALIDATION, "Media object is public");
    }

    // SA-23 audit log for private file access
    await auditService.log(
      ctx,
      "media.download",
      { type: "media", id: row.id },
      null,
      { objectKey: row.objectKey, bucket: row.bucket },
      (tx ?? database) as TxCtx,
    );

    const storage = getStorageDriver();
    const expiresInSeconds = Math.floor(PRESIGNED_GET_TTL_MS / 1000);
    const url = await storage.createPresignedGet(row.bucket, row.objectKey, expiresInSeconds);
    const expiresAt = new Date(Date.now() + PRESIGNED_GET_TTL_MS).toISOString();

    return { url, expiresAt };
  }

  async urlFor(
    m: Pick<Media, "id" | "bucket" | "objectKey" | "visibility">,
    purpose?: UploadPurpose,
  ): Promise<string> {
    if (m.visibility === "public") {
      const baseUrl = getPublicMediaBaseUrl().replace(/\/+$/, "");
      return `${baseUrl}/${m.objectKey}`;
    }

    if (purpose === "product_presentation") {
      const storage = getStorageDriver();
      return await storage.createPresignedGet(m.bucket, m.objectKey, 300);
    }

    return `/api/files/private/${m.id}`;
  }

  async deleteObjects(ctx: Context, mediaIds: readonly string[], tx: TxCtx): Promise<void> {
    if (mediaIds.length === 0) return;

    const rows = await tx
      .select()
      .from(media)
      .where(inArray(media.id, [...mediaIds]));
    if (rows.length === 0) return;

    const storage = getStorageDriver();
    for (const row of rows) {
      try {
        await storage.deleteObject(row.bucket, row.objectKey);
      } catch {
        // Keep going even if storage delete errors
      }
    }

    await tx.delete(media).where(inArray(media.id, [...mediaIds]));
  }

  /* --- API-CAT-06 Product Media Attachments --------------------------------------------------- */

  async attachProductMedia(
    ctx: RequestContext,
    input: AttachProductMediaInput,
    tx?: DbOrTx,
  ): Promise<{ productMedia: ProductMediaView[] }> {
    assertPermission(ctx, "catalog.write");

    const database = await this.getDb(tx);

    // Verify product exists
    const [product] = await database
      .select()
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    if (!product) {
      throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
    }

    if (input.kind === "video_embed") {
      if (!input.embedUrl) {
        throw new AppError(ErrorCode.VALIDATION, "video_embed requires embedUrl");
      }
      validateEmbedUrl(input.embedUrl);
    } else {
      if (!input.mediaId) {
        throw new AppError(ErrorCode.VALIDATION, `${input.kind} requires mediaId`);
      }

      const [mediaRow] = await database
        .select()
        .from(media)
        .where(eq(media.id, input.mediaId))
        .limit(1);

      if (!mediaRow) {
        throw new AppError(ErrorCode.NOT_FOUND, "Media object not found");
      }

      // Check kind visibility rules (API-CAT-06)
      if (IMAGE_MEDIA_KINDS.includes(input.kind)) {
        if (mediaRow.visibility !== "public") {
          throw new AppError(ErrorCode.VALIDATION, "Image media must be public");
        }
        if (!input.alt || input.alt.trim().length === 0) {
          throw new AppError(ErrorCode.VALIDATION, "alt text is required for image kinds");
        }
      }

      if (input.kind === "presentation" && mediaRow.mime !== "application/pdf") {
        throw new AppError(ErrorCode.VALIDATION, "Presentation media must be a PDF");
      }
    }

    // Insert product_media row
    await database.insert(productMedia).values({
      id: crypto.randomUUID(),
      productId: input.productId,
      kind: input.kind,
      mediaId: input.mediaId ?? null,
      embedUrl: input.embedUrl ?? null,
      title: input.title ?? null,
      alt: input.alt ?? "",
      position: input.position,
    });

    return await this.listProductMedia(input.productId, database);
  }

  async reorderProductMedia(
    ctx: RequestContext,
    input: { productId: string; productMediaIds: string[] },
    tx?: DbOrTx,
  ): Promise<{ productMedia: ProductMediaView[] }> {
    assertPermission(ctx, "catalog.write");

    const database = await this.getDb(tx);

    for (let pos = 0; pos < input.productMediaIds.length; pos++) {
      const pmId = input.productMediaIds[pos];
      if (!pmId) continue;
      await database
        .update(productMedia)
        .set({ position: pos })
        .where(and(eq(productMedia.id, pmId), eq(productMedia.productId, input.productId)));
    }

    return await this.listProductMedia(input.productId, database);
  }

  async detachProductMedia(
    ctx: RequestContext,
    input: { productId: string; productMediaId: string },
    tx?: DbOrTx,
  ): Promise<{ productMedia: ProductMediaView[] }> {
    assertPermission(ctx, "catalog.write");

    const database = await this.getDb(tx);

    await database
      .delete(productMedia)
      .where(
        and(eq(productMedia.id, input.productMediaId), eq(productMedia.productId, input.productId)),
      );

    return await this.listProductMedia(input.productId, database);
  }

  private async listProductMedia(
    productId: string,
    database: DbOrTx,
  ): Promise<{ productMedia: ProductMediaView[] }> {
    const rows = await database
      .select({
        pm: productMedia,
        m: media,
      })
      .from(productMedia)
      .leftJoin(media, eq(productMedia.mediaId, media.id))
      .where(eq(productMedia.productId, productId))
      .orderBy(asc(productMedia.position));

    const views: ProductMediaView[] = [];
    for (const { pm, m } of rows) {
      let resolvedUrl = "";
      if (pm.kind === "video_embed") {
        resolvedUrl = pm.embedUrl ?? "";
      } else if (m) {
        resolvedUrl = await this.urlFor(
          m,
          pm.kind === "presentation" ? "product_presentation" : undefined,
        );
      }

      views.push({
        id: pm.id,
        kind: pm.kind,
        mediaId: pm.mediaId,
        url: resolvedUrl,
        embedUrl: pm.embedUrl,
        title: pm.title,
        alt: pm.alt,
        position: pm.position,
        mime: m?.mime ?? null,
        width: m?.width ?? null,
        height: m?.height ?? null,
        blurHash: m?.blurHash ?? null,
      });
    }

    return { productMedia: views };
  }
}

export const mediaService: MediaService = new DefaultMediaService();
