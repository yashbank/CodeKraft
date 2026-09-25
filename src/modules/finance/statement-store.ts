/**
 * Document store port for partner statements (API-FIN-10: render to R2 `media(private)`,
 * 5-minute presigned GET). The default implementation writes the object to `R2_BUCKET_DOCUMENTS`
 * with `@aws-sdk/client-s3`, records a `media` row (visibility `private`) inside the caller's
 * transaction and presigns a GET. Tests inject a fake through `createFinanceService(deps)`.
 */
import { createHash } from "node:crypto";
import { media } from "../../../drizzle/schema/media";
import type { TxCtx } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AppError, ErrorCode } from "@/lib/errors";
import { newId } from "@/lib/ids";

export const DOCUMENT_URL_TTL_SECONDS = 300;

export interface DocumentPutInput {
  /** Object key under the documents bucket, e.g. `statements/<partner>/<file>`. */
  objectKey: string;
  filename: string;
  contentType: string;
  body: Uint8Array;
  uploadedBy: string;
}

export interface DocumentPutResult {
  mediaId: string;
  url: string;
  /** ISO-8601 */
  expiresAt: string;
}

export interface DocumentStore {
  put(input: DocumentPutInput, tx: TxCtx): Promise<DocumentPutResult>;
}

/** Inserts the `media` row for a stored document; shared by the R2 store and test fakes. */
export async function insertDocumentMedia(
  input: DocumentPutInput,
  bucket: string,
  tx: TxCtx,
): Promise<string> {
  const checksum = createHash("sha256").update(input.body).digest("hex");
  const [row] = await tx
    .insert(media)
    .values({
      bucket,
      objectKey: input.objectKey,
      mime: input.contentType,
      sizeBytes: input.body.byteLength,
      checksum,
      visibility: "private",
      uploadedBy: input.uploadedBy,
    })
    .returning({ id: media.id });
  if (row === undefined) throw new Error("media insert returned no row");
  return row.id;
}

export function createR2DocumentStore(): DocumentStore {
  return {
    async put(input, tx) {
      const env = getEnv();
      if (
        env.R2_ACCOUNT_ID === undefined ||
        env.R2_ACCESS_KEY_ID === undefined ||
        env.R2_SECRET_ACCESS_KEY === undefined
      ) {
        throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "Document storage is not configured.");
      }
      const [{ S3Client, PutObjectCommand, GetObjectCommand }, { getSignedUrl }] =
        await Promise.all([import("@aws-sdk/client-s3"), import("@aws-sdk/s3-request-presigner")]);
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      });
      const bucket = env.R2_BUCKET_DOCUMENTS;
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: input.objectKey,
            Body: input.body,
            ContentType: input.contentType,
            ContentDisposition: `attachment; filename="${input.filename}"`,
          }),
        );
        const mediaId = await insertDocumentMedia(input, bucket, tx);
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: bucket, Key: input.objectKey }),
          { expiresIn: DOCUMENT_URL_TTL_SECONDS },
        );
        return {
          mediaId,
          url,
          expiresAt: new Date(Date.now() + DOCUMENT_URL_TTL_SECONDS * 1000).toISOString(),
        };
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "Document storage is unavailable.", {
          cause: err,
        });
      } finally {
        client.destroy();
      }
    },
  };
}

/** In-memory store for tests: keeps the bytes, still writes the `media` row. */
export function createMemoryDocumentStore(): DocumentStore & {
  objects: Map<string, DocumentPutInput>;
} {
  const objects = new Map<string, DocumentPutInput>();
  return {
    objects,
    async put(input, tx) {
      objects.set(input.objectKey, input);
      const mediaId = await insertDocumentMedia(input, "memory-documents", tx);
      return {
        mediaId,
        url: `memory://documents/${input.objectKey}?token=${newId()}`,
        expiresAt: new Date(Date.now() + DOCUMENT_URL_TTL_SECONDS * 1000).toISOString(),
      };
    },
  };
}
