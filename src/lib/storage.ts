/**
 * Storage client — docs/04 §7.1, docs/06 §3.5, docs/12 §6, PHASE-03 P3.5.
 *
 * S3-compatible client for Cloudflare R2 and MinIO:
 * - Presigned PUT for uploads (15-min expiry)
 * - Presigned GET for private downloads (5-min expiry per SA-12)
 * - HEAD object (content-length, mime-type verification)
 * - Ranged GET for first bytes (magic-byte sniffing)
 * - Object deletion
 * - Memory driver fallback for hermetic testing
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageDriver {
  createPresignedPut(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<string>;
  createPresignedGet(bucket: string, key: string, expiresInSeconds?: number): Promise<string>;
  headObject(
    bucket: string,
    key: string,
  ): Promise<{ contentLength: number; contentType: string; eTag?: string }>;
  getObjectRange(bucket: string, key: string, start: number, end: number): Promise<Buffer>;
  deleteObject(bucket: string, key: string): Promise<void>;
  deleteObjects(bucket: string, keys: readonly string[]): Promise<void>;
  putObject(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string,
  ): Promise<void>;
}

/** In-memory storage driver for hermetic unit and integration testing without external daemons. */
export class MemoryStorageDriver implements StorageDriver {
  private store = new Map<string, { body: Buffer; contentType: string; updatedAt: Date }>();

  private storageKey(bucket: string, key: string): string {
    return `${bucket}:::${key}`;
  }

  async createPresignedPut(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    return `https://storage.local/upload/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}?contentType=${encodeURIComponent(contentType)}&expires=${expiresAt}`;
  }

  async createPresignedGet(
    bucket: string,
    key: string,
    expiresInSeconds: number = 300,
  ): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    return `https://storage.local/download/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}?expires=${expiresAt}`;
  }

  async headObject(
    bucket: string,
    key: string,
  ): Promise<{ contentLength: number; contentType: string; eTag?: string }> {
    const item = this.store.get(this.storageKey(bucket, key));
    if (!item) {
      const err = new Error(`Object not found in storage: ${bucket}/${key}`);
      (err as unknown as { name: string; $metadata: { httpStatusCode: number } }).name = "NotFound";
      (err as unknown as { $metadata: { httpStatusCode: number } })["$metadata"] = {
        httpStatusCode: 404,
      };
      throw err;
    }
    return {
      contentLength: item.body.length,
      contentType: item.contentType,
      eTag: `"${item.updatedAt.getTime()}"`,
    };
  }

  async getObjectRange(bucket: string, key: string, start: number, end: number): Promise<Buffer> {
    const item = this.store.get(this.storageKey(bucket, key));
    if (!item) {
      throw new Error(`Object not found in storage: ${bucket}/${key}`);
    }
    return item.body.subarray(start, end + 1);
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    this.store.delete(this.storageKey(bucket, key));
  }

  async deleteObjects(bucket: string, keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      this.store.delete(this.storageKey(bucket, key));
    }
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | string,
    contentType: string = "application/octet-stream",
  ): Promise<void> {
    const buf = Buffer.isBuffer(body)
      ? body
      : typeof body === "string"
        ? Buffer.from(body)
        : Buffer.from(body);
    this.store.set(this.storageKey(bucket, key), {
      body: buf,
      contentType,
      updatedAt: new Date(),
    });
  }

  clear(): void {
    this.store.clear();
  }
}

/** Standard S3 / R2 / MinIO driver using @aws-sdk/client-s3. */
export class S3StorageDriver implements StorageDriver {
  private client: S3Client;

  constructor(options?: {
    endpoint?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    forcePathStyle?: boolean;
  }) {
    const endpoint =
      options?.endpoint ??
      process.env.STORAGE_ENDPOINT ??
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined);

    const accessKeyId =
      options?.accessKeyId ?? process.env.R2_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? "";
    const secretAccessKey =
      options?.secretAccessKey ??
      process.env.R2_SECRET_ACCESS_KEY ??
      process.env.AWS_SECRET_ACCESS_KEY ??
      "";

    const isMinio = endpoint?.includes("localhost") || endpoint?.includes("127.0.0.1");

    this.client = new S3Client({
      endpoint,
      region: options?.region ?? "auto",
      forcePathStyle: options?.forcePathStyle ?? isMinio,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  }

  async createPresignedPut(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds: number = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async createPresignedGet(
    bucket: string,
    key: string,
    expiresInSeconds: number = 300,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async headObject(
    bucket: string,
    key: string,
  ): Promise<{ contentLength: number; contentType: string; eTag?: string }> {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const res = await this.client.send(command);
    return {
      contentLength: res.ContentLength ?? 0,
      contentType: res.ContentType ?? "application/octet-stream",
      eTag: res.ETag,
    };
  }

  async getObjectRange(bucket: string, key: string, start: number, end: number): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=${start}-${end}`,
    });
    const res = await this.client.send(command);
    if (!res.Body) {
      throw new Error(`Empty body for object range ${bucket}/${key}`);
    }
    const byteArray = await res.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await this.client.send(command);
  }

  async deleteObjects(bucket: string, keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return;
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((k) => ({ Key: k })),
      },
    });
    await this.client.send(command);
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: typeof body === "string" ? Buffer.from(body) : body,
      ContentType: contentType,
    });
    await this.client.send(command);
  }
}

let activeDriver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (activeDriver) {
    return activeDriver;
  }

  // In test environment without explicit remote storage endpoint, default to memory driver
  if (
    process.env.NODE_ENV === "test" &&
    !process.env.STORAGE_ENDPOINT &&
    !process.env.R2_ACCOUNT_ID
  ) {
    activeDriver = new MemoryStorageDriver();
    return activeDriver;
  }

  activeDriver = new S3StorageDriver();
  return activeDriver;
}

export function setStorageDriver(driver: StorageDriver | null): void {
  activeDriver = driver;
}

export function getPublicBucketName(): string {
  return process.env.R2_BUCKET_PUBLIC ?? "codekraft-public";
}

export function getPrivateBucketName(): string {
  return process.env.R2_BUCKET_PRIVATE ?? "codekraft-private";
}

export function getDocumentsBucketName(): string {
  return process.env.R2_BUCKET_DOCUMENTS ?? "codekraft-documents";
}

export function getPublicMediaBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL ??
    (process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/files/public`
      : "https://media.codekraft.dev")
  );
}
