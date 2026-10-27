/**
 * Local-filesystem storage driver for development (R8-13/R8-14).
 *
 * Used only outside production when no S3/R2/MinIO endpoint is configured, so admin uploads work
 * on a laptop without touching a real bucket. Objects live under `.local-storage/<bucket>/<key>`
 * (git-ignored). Presigned URLs point at `/api/files/local/*` and carry an HMAC signature so the
 * PUT/GET routes only accept URLs this server minted. The PUT URL is relative so the browser
 * uploads to whichever host (site or admin) it is on — no CORS involved.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StorageDriver } from "./storage";

function rootDir(): string {
  return process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), ".local-storage");
}

function secret(): string {
  return process.env.BETTER_AUTH_SECRET ?? "codekraft-local-storage-dev-secret";
}

/** Resolves an object path and refuses keys that would escape the storage root. */
export function localObjectPath(bucket: string, key: string): string {
  const root = path.resolve(rootDir());
  const full = path.resolve(root, bucket, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid object key");
  return full;
}

export function signLocalUrl(op: "put" | "get", bucket: string, key: string, exp: number): string {
  return createHmac("sha256", secret()).update(`${op}\n${bucket}\n${key}\n${exp}`).digest("hex");
}

export function verifyLocalUrl(
  op: "put" | "get",
  bucket: string,
  key: string,
  exp: number,
  sig: string,
): boolean {
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = Buffer.from(signLocalUrl(op, bucket, key, exp), "hex");
  const given = Buffer.from(sig, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function query(op: "put" | "get", bucket: string, key: string, ttlSeconds: number): string {
  const exp = Date.now() + ttlSeconds * 1000;
  const q = new URLSearchParams({
    bucket,
    key,
    exp: String(exp),
    sig: signLocalUrl(op, bucket, key, exp),
  });
  return q.toString();
}

function metaPath(file: string): string {
  return `${file}.__meta.json`;
}

export class LocalFsStorageDriver implements StorageDriver {
  async createPresignedPut(
    bucket: string,
    key: string,
    _contentType: string,
    expiresInSeconds: number = 900,
  ): Promise<string> {
    return `/api/files/local?${query("put", bucket, key, expiresInSeconds)}`;
  }

  async createPresignedGet(
    bucket: string,
    key: string,
    expiresInSeconds: number = 300,
  ): Promise<string> {
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
    return `${base}/api/files/local?${query("get", bucket, key, expiresInSeconds)}`;
  }

  async headObject(
    bucket: string,
    key: string,
  ): Promise<{ contentLength: number; contentType: string; eTag?: string }> {
    const file = localObjectPath(bucket, key);
    try {
      const s = await stat(file);
      return {
        contentLength: s.size,
        contentType: await this.readContentType(file),
        eTag: `"${s.mtimeMs}"`,
      };
    } catch {
      const err = new Error(`Object not found in storage: ${bucket}/${key}`);
      Object.assign(err, { name: "NotFound", $metadata: { httpStatusCode: 404 } });
      throw err;
    }
  }

  async getObjectRange(bucket: string, key: string, start: number, end: number): Promise<Buffer> {
    const body = await readFile(localObjectPath(bucket, key));
    return body.subarray(start, end + 1);
  }

  async getObject(
    bucket: string,
    key: string,
  ): Promise<{ body: Buffer; contentType: string; contentLength: number }> {
    const file = localObjectPath(bucket, key);
    const body = await readFile(file);
    return { body, contentType: await this.readContentType(file), contentLength: body.length };
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const file = localObjectPath(bucket, key);
    await rm(file, { force: true });
    await rm(metaPath(file), { force: true });
  }

  async deleteObjects(bucket: string, keys: readonly string[]): Promise<void> {
    for (const key of keys) await this.deleteObject(bucket, key);
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | string,
    contentType: string = "application/octet-stream",
  ): Promise<void> {
    const file = localObjectPath(bucket, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, typeof body === "string" ? Buffer.from(body) : body);
    await writeFile(metaPath(file), JSON.stringify({ contentType }));
  }

  private async readContentType(file: string): Promise<string> {
    try {
      const meta = JSON.parse(await readFile(metaPath(file), "utf8")) as { contentType?: string };
      return meta.contentType ?? "application/octet-stream";
    } catch {
      return "application/octet-stream";
    }
  }
}
