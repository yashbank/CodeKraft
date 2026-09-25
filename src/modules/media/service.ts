/**
 * `media` service (PHASE-03 P3.5; docs/06 API-CAT-06, API-CAT-21, §3.5; docs/12 §6; A-1202,
 * A-1402, SA-12, SA-13, TM-12).
 *
 * Upload flow: `createUploadIntent` validates purpose/MIME/size/extension, stores a
 * `files_upload_intents` row with a server-chosen key and returns a 15-minute presigned PUT;
 * `completeUpload` HEADs the object, checks size + Content-Type, sniffs magic bytes, inserts
 * `media` and marks the intent consumed. Private objects are only ever reached through 5-minute
 * presigned GETs; public ones through `NEXT_PUBLIC_MEDIA_BASE_URL`.
 */
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { assertAnyPermission, assertPermission, can } from "@/lib/authz/assert";
import type { Context, RequestContext } from "@/lib/authz/context";
import { productScope } from "@/lib/authz/scope";
import { type DbOrTx, type TxCtx, getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AppError, ErrorCode } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { moduleLogger } from "@/lib/logger";
import { type RateLimitResult, checkClass } from "@/lib/rate-limit";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import { productMedia, products } from "../../../drizzle/schema/catalog";
import { media } from "../../../drizzle/schema/media";
import { filesUploadIntents } from "../../../drizzle/schema/ops";
import { productOwnershipLines, productOwnerships } from "../../../drizzle/schema/ownership";
import type { AuditService } from "../audit/contracts";
import { auditService } from "../audit/service";
import { runInTx } from "../audit/tx";
import type {
  AttachProductMediaInput,
  CompleteUploadResult,
  CreateUploadIntentInput,
  MediaService,
  UploadIntentResult,
  completeUploadSchema,
  detachProductMediaSchema,
  privateMediaLinkSchema,
  reorderProductMediaSchema,
} from "./contracts";
import { SNIFF_BYTES, imageDimensions, magicMatches } from "./sniff";
import {
  type StorageBuckets,
  type StorageClient,
  getDefaultBuckets,
  getDefaultStorage,
} from "./storage";
import {
  CUSTOMER_UPLOAD_PURPOSES,
  IMAGE_MEDIA_KINDS,
  type Media,
  type MediaVisibilityValue,
  PRESIGNED_GET_TTL_MS,
  type ProductMediaView,
  UPLOAD_INTENT_TTL_MS,
  UPLOAD_RULES,
  type UploadPurpose,
} from "./types";
import { normaliseMime, objectKeyFor, validateUploadRequest } from "./validation";
import type { z } from "zod";

export interface MediaDeps {
  db: () => DbOrTx;
  audit: AuditService;
  storage: () => StorageClient;
  buckets: () => StorageBuckets;
  /** `NEXT_PUBLIC_MEDIA_BASE_URL` (public bucket custom domain); `null` → presigned fallback. */
  publicBaseUrl: () => string | null;
  rateLimit?: (ctx: RequestContext) => Promise<RateLimitResult>;
  now?: () => Date;
  newId?: () => string;
}

export interface StorageUsageRow {
  bucket: string;
  visibility: MediaVisibilityValue;
  objects: number;
  bytes: number;
}

/** 70 % of the R2 free tier (NFR-OPS-03, docs/12 §6). */
export const STORAGE_WARN_BYTES = 7 * 1024 * 1024 * 1024;

export interface MediaServiceImpl extends MediaService {
  /** Sum of `media.size_bytes` per bucket for the System widget. */
  storageUsage(ctx: RequestContext, tx?: DbOrTx): Promise<{ rows: StorageUsageRow[]; warnBytes: number; warn: boolean }>;
  /** Read model for a product's media block (API-CAT-19/31 view builders). */
  listProductMedia(productId: string, tx?: DbOrTx): Promise<ProductMediaView[]>;
}

const log = moduleLogger("media");

function validation(field: string, message: string): AppError {
  return new AppError(ErrorCode.VALIDATION, message, { fieldErrors: { [field]: [message] } });
}

function base64ToHex(b64: string): string {
  return Buffer.from(b64, "base64").toString("hex");
}

export function createMediaService(deps: MediaDeps): MediaServiceImpl {
  const now = deps.now ?? (() => new Date());
  const mkId = deps.newId ?? newId;
  const rateLimit =
    deps.rateLimit ?? ((ctx: RequestContext) => checkClass("upload", { user: ctx.userId }));

  function bucketFor(visibility: MediaVisibilityValue): string {
    return visibility === "public" ? deps.buckets().public : deps.buckets().private;
  }

  async function urlFor(
    m: Pick<Media, "id" | "bucket" | "objectKey" | "visibility">,
    _purpose?: UploadPurpose,
  ): Promise<string> {
    if (m.visibility === "public") {
      const base = deps.publicBaseUrl();
      if (base !== null) return `${base.replace(/\/+$/, "")}/${m.objectKey}`;
    }
    return deps.storage().presignGet({
      bucket: m.bucket,
      key: m.objectKey,
      expiresInSeconds: PRESIGNED_GET_TTL_MS / 1000,
    });
  }

  async function createUploadIntent(
    ctx: RequestContext,
    input: CreateUploadIntentInput,
    tx?: DbOrTx,
  ): Promise<UploadIntentResult> {
    if (!CUSTOMER_UPLOAD_PURPOSES.includes(input.purpose)) assertPermission(ctx, "media.upload");
    const limit = await rateLimit(ctx);
    if (!limit.allowed) {
      throw new AppError(ErrorCode.RATE_LIMITED, undefined, {
        retryAfterMs: Math.max(0, limit.resetAt - now().getTime()),
      });
    }
    const valid = validateUploadRequest(input);
    const at = now();
    const id = mkId();
    const objectKey = objectKeyFor(at, id, valid.ext);
    const expiresAt = new Date(at.getTime() + UPLOAD_INTENT_TTL_MS);
    const db = tx ?? deps.db();
    const [row] = await db
      .insert(filesUploadIntents)
      .values({
        userId: ctx.userId,
        purpose: valid.purpose,
        mime: valid.mime,
        sizeBytes: input.sizeBytes,
        objectKey,
        expiresAt,
      })
      .returning({ id: filesUploadIntents.id });
    if (row === undefined) throw new AppError(ErrorCode.INTERNAL, "intent insert returned no row");
    const uploadUrl = await deps.storage().presignPut({
      bucket: bucketFor(valid.visibility),
      key: objectKey,
      contentType: valid.mime,
      contentLength: input.sizeBytes,
      expiresInSeconds: UPLOAD_INTENT_TTL_MS / 1000,
    });
    return {
      intentId: row.id,
      uploadUrl,
      objectKey,
      headers: { "Content-Type": valid.mime },
      visibility: valid.visibility,
    };
  }

  async function completeUpload(
    ctx: RequestContext,
    input: z.infer<typeof completeUploadSchema>,
    tx?: DbOrTx,
  ): Promise<CompleteUploadResult> {
    return runInTx(tx ?? deps.db(), async (t) => {
      const [intent] = await t
        .select()
        .from(filesUploadIntents)
        .where(eq(filesUploadIntents.id, input.intentId))
        .for("update");
      if (intent === undefined || intent.userId !== ctx.userId) {
        throw new AppError(ErrorCode.NOT_FOUND, "Upload intent not found.");
      }
      if (intent.consumed) throw new AppError(ErrorCode.STATE_INVALID, "Upload already completed.");
      if (intent.expiresAt.getTime() < now().getTime()) {
        throw new AppError(ErrorCode.STATE_INVALID, "Upload intent expired.");
      }
      const purpose = intent.purpose as UploadPurpose;
      const rule = UPLOAD_RULES[purpose];
      const visibility = rule.visibility;
      const ref = { bucket: bucketFor(visibility), key: intent.objectKey };
      const storage = deps.storage();
      const head = await storage.head(ref);
      if (head === null) throw validation("object", "object was not uploaded");
      const reject = async (field: string, message: string): Promise<never> => {
        try {
          await storage.deleteObject(ref);
        } catch (err) {
          log.warn({ err, key: ref.key }, "could not delete rejected upload");
        }
        throw validation(field, message);
      };
      if (head.contentLength !== intent.sizeBytes) {
        return reject("sizeBytes", "uploaded size does not match the intent");
      }
      if (head.contentType !== null && normaliseMime(head.contentType) !== intent.mime) {
        return reject("mime", "uploaded content-type does not match the intent");
      }
      const bytes = await storage.readRange(ref, SNIFF_BYTES);
      if (!magicMatches(intent.mime, bytes)) {
        return reject("mime", "file content does not match the declared type");
      }
      const dims = intent.mime.startsWith("image/") ? imageDimensions(intent.mime, bytes) : null;
      const checksum =
        head.checksumSha256 !== null
          ? base64ToHex(head.checksumSha256)
          : (head.etag ?? "").replace(/"/g, "") || `intent:${intent.id}`;
      const [row] = await t
        .insert(media)
        .values({
          bucket: ref.bucket,
          objectKey: intent.objectKey,
          mime: intent.mime,
          sizeBytes: intent.sizeBytes,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          checksum,
          blurHash: null,
          visibility,
          uploadedBy: ctx.userId,
        })
        .returning({ id: media.id });
      if (row === undefined) throw new AppError(ErrorCode.INTERNAL, "media insert returned no row");
      const consumed = await t
        .update(filesUploadIntents)
        .set({ consumed: true })
        .where(and(eq(filesUploadIntents.id, intent.id), eq(filesUploadIntents.consumed, false)))
        .returning({ id: filesUploadIntents.id });
      if (consumed.length === 0) throw new AppError(ErrorCode.STATE_INVALID, "Upload already completed.");
      if (can(ctx, "media.upload")) {
        await deps.audit.log(
          ctx,
          "API-CAT-21 media.upload_complete",
          { type: "media", id: row.id },
          null,
          { purpose, mime: intent.mime, sizeBytes: intent.sizeBytes, objectKey: intent.objectKey, visibility },
          t,
        );
      }
      const result: CompleteUploadResult = { mediaId: row.id };
      if (visibility === "public") {
        result.url = await urlFor({ id: row.id, bucket: ref.bucket, objectKey: intent.objectKey, visibility });
      }
      return result;
    });
  }

  async function getPrivateMediaUrl(
    ctx: RequestContext,
    input: z.infer<typeof privateMediaLinkSchema>,
    tx?: DbOrTx,
  ): Promise<{ url: string; expiresAt: string }> {
    assertAnyPermission(ctx, ["catalog.read", "invoices.read"]);
    return runInTx(tx ?? deps.db(), async (t) => {
      const [m] = await t.select().from(media).where(eq(media.id, input.mediaId)).limit(1);
      if (m === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Media not found.");
      const at = now();
      const url = await deps.storage().presignGet({
        bucket: m.bucket,
        key: m.objectKey,
        expiresInSeconds: PRESIGNED_GET_TTL_MS / 1000,
      });
      await deps.audit.log(
        ctx,
        "API-CAT-21 media.private_link",
        { type: "media", id: m.id },
        null,
        { objectKey: m.objectKey, visibility: m.visibility, mime: m.mime },
        t,
      );
      return { url, expiresAt: new Date(at.getTime() + PRESIGNED_GET_TTL_MS).toISOString() };
    });
  }

  async function deleteObjects(ctx: Context, mediaIds: readonly string[], tx: TxCtx): Promise<void> {
    if (mediaIds.length === 0) return;
    const rows = await tx.select().from(media).where(inArray(media.id, [...mediaIds]));
    for (const m of rows) {
      if (m.visibility !== "private") continue;
      try {
        await deps.storage().deleteObject({ bucket: m.bucket, key: m.objectKey });
      } catch (err) {
        log.warn({ err, mediaId: m.id }, "storage delete failed; row still removed");
      }
    }
    await tx.delete(media).where(inArray(media.id, rows.map((m) => m.id)));
    await deps.audit.log(
      ctx.userId === null ? { kind: "system", name: "system", requestId: ctx.requestId } : ctx,
      "API-CAT-15 media.delete",
      { type: "media", id: rows.length === 1 ? (rows[0]?.id ?? "-") : "batch" },
      { mediaIds: rows.map((m) => m.id), objectKeys: rows.map((m) => m.objectKey) },
      null,
      tx,
    );
  }

  /* --- API-CAT-06 product media ---------------------------------------------------------- */

  async function assertProductInScope(ctx: RequestContext, productId: string, db: DbOrTx) {
    const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
    if (product === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Product not found.");
    const scope = productScope(ctx);
    if (scope === "all") return;
    const [line] = await db
      .select({ id: productOwnerships.id })
      .from(productOwnerships)
      .innerJoin(productOwnershipLines, eq(productOwnershipLines.ownershipId, productOwnerships.id))
      .where(
        and(
          eq(productOwnerships.productId, productId),
          eq(productOwnershipLines.partnerId, scope.partnerId),
          or(eq(productOwnerships.status, "active"), eq(productOwnerships.status, "pending")),
        ),
      )
      .limit(1);
    if (line === undefined) throw new AppError(ErrorCode.FORBIDDEN, undefined, { cause: { scope: "product" } });
  }

  async function listProductMedia(productId: string, tx?: DbOrTx): Promise<ProductMediaView[]> {
    const db = tx ?? deps.db();
    const rows = await db
      .select({ pm: productMedia, m: media })
      .from(productMedia)
      .leftJoin(media, eq(media.id, productMedia.mediaId))
      .where(eq(productMedia.productId, productId))
      .orderBy(asc(productMedia.position), asc(productMedia.createdAt));
    return Promise.all(
      rows.map(async ({ pm, m }) => ({
        id: pm.id,
        kind: pm.kind,
        mediaId: pm.mediaId,
        url: pm.embedUrl ?? (m === null ? "" : await urlFor(m)),
        embedUrl: pm.embedUrl,
        title: pm.title,
        alt: pm.alt,
        position: pm.position,
        mime: m?.mime ?? null,
        width: m?.width ?? null,
        height: m?.height ?? null,
        blurHash: m?.blurHash ?? null,
      })),
    );
  }

  function checkKindAgainstMedia(kind: ProductMediaView["kind"], m: Media): void {
    if (IMAGE_MEDIA_KINDS.includes(kind)) {
      if (m.visibility !== "public") throw validation("mediaId", "image kinds need a public media object");
      if (!m.mime.startsWith("image/")) throw validation("mediaId", "image kinds need an image");
      return;
    }
    switch (kind) {
      case "attachment":
        if (m.visibility !== "private") throw validation("mediaId", "attachments must be private");
        return;
      case "presentation":
        if (m.mime !== "application/pdf") throw validation("mediaId", "presentation must be application/pdf");
        return;
      case "video_file":
        if (!m.mime.startsWith("video/")) throw validation("mediaId", "video_file needs a video");
        if (m.visibility !== "public") throw validation("mediaId", "video_file must be public");
        return;
      default:
        return;
    }
  }

  async function attachProductMedia(
    ctx: RequestContext,
    input: AttachProductMediaInput,
    tx?: DbOrTx,
  ): Promise<{ productMedia: ProductMediaView[] }> {
    assertPermission(ctx, "catalog.write");
    return runInTx(tx ?? deps.db(), async (t) => {
      await assertProductInScope(ctx, input.productId, t);
      if (input.mediaId !== undefined) {
        const [m] = await t.select().from(media).where(eq(media.id, input.mediaId)).limit(1);
        if (m === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Media not found.");
        checkKindAgainstMedia(input.kind, m);
      }
      const [row] = await t
        .insert(productMedia)
        .values({
          productId: input.productId,
          kind: input.kind,
          mediaId: input.mediaId ?? null,
          embedUrl: input.embedUrl ?? null,
          title: input.title ?? null,
          alt: input.alt,
          position: input.position,
        })
        .returning();
      await deps.audit.log(
        ctx,
        "API-CAT-06 product_media.attach",
        { type: "product", id: input.productId },
        null,
        row ?? null,
        t,
      );
      return { productMedia: await listProductMedia(input.productId, t) };
    });
  }

  async function reorderProductMedia(
    ctx: RequestContext,
    input: z.infer<typeof reorderProductMediaSchema>,
    tx?: DbOrTx,
  ): Promise<{ productMedia: ProductMediaView[] }> {
    assertPermission(ctx, "catalog.write");
    return runInTx(tx ?? deps.db(), async (t) => {
      await assertProductInScope(ctx, input.productId, t);
      const existing = await t
        .select({ id: productMedia.id, position: productMedia.position })
        .from(productMedia)
        .where(eq(productMedia.productId, input.productId));
      const ids = new Set(existing.map((r) => r.id));
      const given = new Set(input.productMediaIds);
      if (given.size !== input.productMediaIds.length || ids.size !== given.size || [...given].some((id) => !ids.has(id))) {
        throw validation("productMediaIds", "must list every product media id exactly once");
      }
      for (const [position, id] of input.productMediaIds.entries()) {
        await t.update(productMedia).set({ position }).where(eq(productMedia.id, id));
      }
      await deps.audit.log(
        ctx,
        "API-CAT-06 product_media.reorder",
        { type: "product", id: input.productId },
        { order: [...existing].sort((a, b) => a.position - b.position).map((r) => r.id) },
        { order: input.productMediaIds },
        t,
      );
      return { productMedia: await listProductMedia(input.productId, t) };
    });
  }

  async function detachProductMedia(
    ctx: RequestContext,
    input: z.infer<typeof detachProductMediaSchema>,
    tx?: DbOrTx,
  ): Promise<{ productMedia: ProductMediaView[] }> {
    assertPermission(ctx, "catalog.write");
    return runInTx(tx ?? deps.db(), async (t) => {
      await assertProductInScope(ctx, input.productId, t);
      const [removed] = await t
        .delete(productMedia)
        .where(and(eq(productMedia.id, input.productMediaId), eq(productMedia.productId, input.productId)))
        .returning();
      if (removed === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Product media not found.");
      await deps.audit.log(
        ctx,
        "API-CAT-06 product_media.detach",
        { type: "product", id: input.productId },
        removed,
        null,
        t,
      );
      return { productMedia: await listProductMedia(input.productId, t) };
    });
  }

  async function storageUsage(ctx: RequestContext, tx?: DbOrTx) {
    assertPermission(ctx, "dashboard.admin");
    const db = tx ?? deps.db();
    const rows = await db
      .select({
        bucket: media.bucket,
        visibility: media.visibility,
        objects: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(${media.sizeBytes}), 0)::bigint`,
      })
      .from(media)
      .groupBy(media.bucket, media.visibility);
    const out: StorageUsageRow[] = rows.map((r) => ({
      bucket: r.bucket,
      visibility: r.visibility,
      objects: r.objects,
      bytes: Number(r.bytes),
    }));
    const warn = out.some((r) => r.bytes >= STORAGE_WARN_BYTES);
    return { rows: out, warnBytes: STORAGE_WARN_BYTES, warn };
  }

  return {
    attachProductMedia,
    reorderProductMedia,
    detachProductMedia,
    createUploadIntent,
    completeUpload,
    getPrivateMediaUrl,
    urlFor,
    deleteObjects,
    storageUsage,
    listProductMedia,
  };
}

export const mediaService: MediaServiceImpl = createMediaService({
  db: () => getDb(),
  audit: auditService,
  storage: () => getDefaultStorage(),
  buckets: () => getDefaultBuckets(),
  publicBaseUrl: () => {
    const base = getEnv().NEXT_PUBLIC_MEDIA_BASE_URL;
    return base === undefined || base === "" ? null : base;
  },
});

/** P2.8 skeleton kept for modules that still fall back to a NotImplemented media port. */
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
