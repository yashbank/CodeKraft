/**
 * Download presigning — docs/06 §3.5 / API-DEL-02, §5.7 step 3, TM-04, SA-11/12, PHASE-05 P5.3.
 *
 * `DownloadPresigner` is the port the entitlements service uses to turn a `release_files.media`
 * object into a 5-minute presigned GET with `response-content-disposition=attachment;
 * filename="<product>-<version>.<ext>"`. Two adapters:
 *  - `createS3DownloadPresigner` — SigV4 presign with the installed AWS SDK against R2/MinIO
 *    (no network call; the signature is computed locally, so it is safe inside the transaction);
 *  - `mediaServicePresigner` — delegates to `MediaService.urlFor` (P3.5) for deployments that
 *    prefer the media module's storage client. Tests inject a fake.
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError, ErrorCode } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import type { MediaService } from "@/modules/media/contracts";

/** 5 minutes (docs/06 API-DEL-02, SA-11). */
export const DOWNLOAD_URL_TTL_SECONDS = 300;

export interface PresignDownloadInput {
  bucket: string;
  objectKey: string;
  /** Attachment filename offered to the browser. */
  filename: string;
  ttlSeconds: number;
  /** For adapters that key on the media row (`MediaService.urlFor`). */
  mediaId: string;
  mime: string;
}

export interface PresignedDownload {
  url: string;
  expiresAt: Date;
}

export interface DownloadPresigner {
  presignGet(input: PresignDownloadInput, now: Date): Promise<PresignedDownload>;
}

/** `<product-slug>-<version>.<ext>` with unsafe characters stripped (header-safe, TM-04). */
export function downloadFilename(productSlug: string, version: string, objectKey: string): string {
  const extMatch = /\.([A-Za-z0-9]{1,10})$/.exec(objectKey);
  const ext = extMatch === null ? "zip" : (extMatch[1] as string).toLowerCase();
  const base = `${productSlug}-${version}`.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return `${base}.${ext}`;
}

export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replaceAll('"', "");
  return `attachment; filename="${ascii}"`;
}

export interface S3PresignerConfig {
  endpoint: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** MinIO needs path-style addressing; R2 accepts it too. */
  forcePathStyle?: boolean;
}

/** SigV4 presigner over the installed AWS SDK; `client` may be injected (tests, custom endpoint). */
export function createS3DownloadPresigner(
  config: S3PresignerConfig | (() => S3PresignerConfig),
  client?: S3Client,
): DownloadPresigner {
  let cached: S3Client | undefined = client;
  const resolveClient = (): S3Client => {
    if (cached !== undefined) return cached;
    const c = typeof config === "function" ? config() : config;
    cached = new S3Client({
      region: c.region ?? "auto",
      endpoint: c.endpoint,
      forcePathStyle: c.forcePathStyle ?? true,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    });
    return cached;
  };
  return {
    async presignGet(input, now) {
      const command = new GetObjectCommand({
        Bucket: input.bucket,
        Key: input.objectKey,
        ResponseContentDisposition: contentDisposition(input.filename),
        ResponseContentType: input.mime,
      });
      const url = await getSignedUrl(resolveClient(), command, {
        expiresIn: input.ttlSeconds,
        signingDate: now,
      });
      return { url, expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000) };
    },
  };
}

/** R2 config from env (`R2_ACCOUNT_ID` → `https://<id>.r2.cloudflarestorage.com`); MinIO via `S3_ENDPOINT`. */
export function s3ConfigFromEnv(): S3PresignerConfig {
  const env = getEnv();
  const endpoint =
    process.env.S3_ENDPOINT ??
    (env.R2_ACCOUNT_ID !== undefined
      ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined);
  if (
    endpoint === undefined ||
    env.R2_ACCESS_KEY_ID === undefined ||
    env.R2_SECRET_ACCESS_KEY === undefined
  ) {
    throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, "File storage is not configured.");
  }
  return {
    endpoint,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    forcePathStyle: true,
  };
}

/** Adapter over the media module's resolver (`MediaService.urlFor`, 5-minute signed GET for private media). */
export function mediaServicePresigner(media: Pick<MediaService, "urlFor">): DownloadPresigner {
  return {
    async presignGet(input, now) {
      const url = await media.urlFor(
        { id: input.mediaId, bucket: input.bucket, objectKey: input.objectKey, visibility: "private" },
        "release_file",
      );
      return { url, expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000) };
    },
  };
}
