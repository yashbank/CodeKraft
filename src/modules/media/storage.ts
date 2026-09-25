/**
 * Object storage client for R2 / MinIO (docs/12 §6, docs/06 §3.5, A-1202, NFR-SEC-04).
 *
 * `StorageClient` is the port every module uses (media uploads, audit CSV exports, invoice PDFs);
 * `createS3StorageClient` wraps `@aws-sdk/client-s3` + the request presigner, and
 * `getDefaultStorage()` builds it lazily from env (`R2_*`; `forcePathStyle` for MinIO-style
 * endpoints). Presigned GETs default to 5 minutes and are capped there (SA-12).
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "@/lib/env";
import { PRESIGNED_GET_TTL_MS, UPLOAD_INTENT_TTL_MS } from "./types";

export const PRESIGNED_GET_MAX_SECONDS = PRESIGNED_GET_TTL_MS / 1000;
export const PRESIGNED_PUT_SECONDS = UPLOAD_INTENT_TTL_MS / 1000;

export interface ObjectRef {
  bucket: string;
  key: string;
}

export interface HeadResult {
  contentLength: number;
  contentType: string | null;
  etag: string | null;
  /** Base64 SHA-256 when the uploader sent `x-amz-checksum-sha256`. */
  checksumSha256: string | null;
}

export interface PresignPutInput extends ObjectRef {
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}

export interface PresignGetInput extends ObjectRef {
  /** `attachment; filename="…"` — single-purpose download links (docs/06 §3.5). */
  responseContentDisposition?: string;
  /** Capped at 300 s (SA-12). */
  expiresInSeconds?: number;
}

export interface StorageClient {
  presignPut(input: PresignPutInput): Promise<string>;
  presignGet(input: PresignGetInput): Promise<string>;
  head(ref: ObjectRef): Promise<HeadResult | null>;
  /** First `length` bytes of the object (magic-byte sniffing, image headers). */
  readRange(ref: ObjectRef, length: number): Promise<Uint8Array>;
  putObject(input: ObjectRef & { body: Uint8Array | string; contentType: string }): Promise<void>;
  deleteObject(ref: ObjectRef): Promise<void>;
}

export interface StorageBuckets {
  public: string;
  private: string;
  documents: string;
}

export function clampGetExpiry(seconds: number | undefined): number {
  const s = seconds ?? PRESIGNED_GET_MAX_SECONDS;
  return Math.max(1, Math.min(PRESIGNED_GET_MAX_SECONDS, Math.floor(s)));
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
}

export function createS3StorageClient(s3: S3Client): StorageClient {
  return {
    presignPut: (input) =>
      getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          ContentType: input.contentType,
          ContentLength: input.contentLength,
        }),
        { expiresIn: input.expiresInSeconds ?? PRESIGNED_PUT_SECONDS },
      ),
    presignGet: (input) =>
      getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          ...(input.responseContentDisposition !== undefined
            ? { ResponseContentDisposition: input.responseContentDisposition }
            : {}),
        }),
        { expiresIn: clampGetExpiry(input.expiresInSeconds) },
      ),
    async head(ref) {
      try {
        const out = await s3.send(
          new HeadObjectCommand({ Bucket: ref.bucket, Key: ref.key, ChecksumMode: "ENABLED" }),
        );
        return {
          contentLength: out.ContentLength ?? 0,
          contentType: out.ContentType ?? null,
          etag: out.ETag ?? null,
          checksumSha256: out.ChecksumSHA256 ?? null,
        };
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    async readRange(ref, length) {
      const out = await s3.send(
        new GetObjectCommand({
          Bucket: ref.bucket,
          Key: ref.key,
          Range: `bytes=0-${String(Math.max(0, length - 1))}`,
        }),
      );
      if (out.Body === undefined) return new Uint8Array(0);
      return out.Body.transformToByteArray();
    },
    async putObject(input) {
      await s3.send(
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    },
    async deleteObject(ref) {
      await s3.send(new DeleteObjectCommand({ Bucket: ref.bucket, Key: ref.key }));
    },
  };
}

let defaultClient: StorageClient | undefined;

/** R2 endpoint from the account id; `S3_ENDPOINT` (MinIO) wins when set and forces path style. */
export function storageEndpoint(env: {
  R2_ACCOUNT_ID?: string | undefined;
}): { endpoint: string | undefined; forcePathStyle: boolean } {
  const custom = process.env.S3_ENDPOINT;
  if (custom !== undefined && custom !== "") return { endpoint: custom, forcePathStyle: true };
  if (env.R2_ACCOUNT_ID !== undefined && env.R2_ACCOUNT_ID !== "") {
    return { endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, forcePathStyle: false };
  }
  return { endpoint: undefined, forcePathStyle: false };
}

export function getDefaultStorage(): StorageClient {
  if (defaultClient !== undefined) return defaultClient;
  const env = getEnv();
  const { endpoint, forcePathStyle } = storageEndpoint(env);
  const s3 = new S3Client({
    region: "auto",
    ...(endpoint !== undefined ? { endpoint } : {}),
    forcePathStyle,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
  defaultClient = createS3StorageClient(s3);
  return defaultClient;
}

export function getDefaultBuckets(): StorageBuckets {
  const env = getEnv();
  return {
    public: env.R2_BUCKET_PUBLIC,
    private: env.R2_BUCKET_PRIVATE,
    documents: env.R2_BUCKET_DOCUMENTS,
  };
}

/** Unit tests inject a fake through service deps; this resets the lazily built default. */
export function resetDefaultStorage(): void {
  defaultClient = undefined;
}
