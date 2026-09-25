/**
 * Shared plumbing for the content and blog services (P3.10 / P3.11): transaction joining,
 * Postgres error mapping, media → `ImageRef`, site/media URL resolution, timestamps.
 * Nothing here is part of the frozen contracts.
 */
import { type Db, type DbOrTx, type TxCtx, db, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { Media } from "../../../drizzle/schema/media";
import type { ImageRef } from "../catalog/types";

/* --- transactions --------------------------------------------------------------------------- */

function isRootDb(handle: DbOrTx): handle is Db {
  return "$client" in handle;
}

/**
 * Run `fn` inside a transaction: joins `tx` when it is one, opens one on the root client (or the
 * given `Db`) otherwise. Services accept `tx?: DbOrTx` per the frozen contracts.
 */
export function runInTx<T>(tx: DbOrTx | undefined, fn: (tx: TxCtx) => Promise<T>): Promise<T> {
  if (tx === undefined) return withTx(fn);
  if (isRootDb(tx)) return tx.transaction((inner) => fn(inner));
  return fn(tx);
}

/** Read handle: the given one or the pooled client. */
export function reader(tx: DbOrTx | undefined): DbOrTx {
  return tx ?? db;
}

/* --- errors --------------------------------------------------------------------------------- */

interface PgErrorLike {
  code?: unknown;
  constraint_name?: unknown;
  constraint?: unknown;
}

/** Walk the `cause` chain (drizzle wraps driver errors) for a Postgres error code. */
export function pgErrorCode(err: unknown): string | undefined {
  for (let e: unknown = err; e !== null && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const code = (e as PgErrorLike).code;
    if (typeof code === "string" && /^\d{5}$/.test(code)) return code;
  }
  return undefined;
}

export function pgConstraintName(err: unknown): string | undefined {
  for (let e: unknown = err; e !== null && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const c = (e as PgErrorLike).constraint_name ?? (e as PgErrorLike).constraint;
    if (typeof c === "string") return c;
  }
  return undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === "23505";
}

/**
 * Rethrow a unique violation as `CONFLICT` (docs/06 §1.4 "slug taken"), everything else as-is.
 * `field` names the input key in `fieldErrors`.
 */
export function rethrowConflict(err: unknown, field: string, message?: string): never {
  if (isAppError(err)) throw err;
  if (isUniqueViolation(err)) {
    throw new AppError(ErrorCode.CONFLICT, message ?? `${field} is already in use`, {
      fieldErrors: { [field]: [message ?? "already in use"] },
      cause: err,
    });
  }
  throw err;
}

function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function notFound(what: string): AppError {
  return new AppError(ErrorCode.NOT_FOUND, `${what} not found`);
}

/* --- URLs ----------------------------------------------------------------------------------- */

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Absolute site origin for JSON-LD and canonical URLs. Reads the raw env so unit tests and build
 * steps do not need the full `getEnv()` set; production always has `NEXT_PUBLIC_SITE_URL`.
 */
export function siteUrl(): string {
  const raw = process.env["NEXT_PUBLIC_SITE_URL"];
  return stripSlash(raw !== undefined && raw !== "" ? raw : "http://localhost:3000");
}

export function siteHost(): string {
  try {
    return new URL(siteUrl()).host;
  } catch {
    return "localhost:3000";
  }
}

/**
 * Public URL of a `public` media object: `NEXT_PUBLIC_MEDIA_BASE_URL/<objectKey>` (docs/12 §2.2;
 * the CDN/MinIO host serves the public bucket at its root). Private objects never get a URL here
 * (they need the media module's presigned link). Replaceable per service through `deps.mediaUrl`.
 */
export type MediaUrlResolver = (media: Pick<Media, "id" | "bucket" | "objectKey" | "visibility">) => string | null;

export const defaultMediaUrl: MediaUrlResolver = (media) => {
  if (media.visibility !== "public") return null;
  const base = process.env["NEXT_PUBLIC_MEDIA_BASE_URL"];
  const root = base !== undefined && base !== "" ? stripSlash(base) : "/media";
  return `${root}/${media.objectKey.replace(/^\/+/, "")}`;
};

export type ImageMedia = Pick<
  Media,
  "id" | "bucket" | "objectKey" | "visibility" | "width" | "height" | "blurHash"
>;

/** `ImageRef` for a media row, or `null` when the row is missing or not public. */
export function imageRef(
  media: ImageMedia | null | undefined,
  alt: string,
  resolve: MediaUrlResolver = defaultMediaUrl,
): ImageRef | null {
  if (media === null || media === undefined) return null;
  const url = resolve(media);
  if (url === null) return null;
  return {
    mediaId: media.id,
    url,
    alt,
    width: media.width,
    height: media.height,
    blurHash: media.blurHash,
  };
}

/* --- misc ----------------------------------------------------------------------------------- */

export function iso(date: Date | null | undefined): string | null {
  return date === null || date === undefined ? null : date.toISOString();
}

/** JSON round-trip so audit `before`/`after` never carry `Date` objects or `undefined`. */
export function snapshot<T>(value: T): unknown {
  return value === undefined ? null : (JSON.parse(JSON.stringify(value)) as unknown);
}

/** Ordered, de-duplicated list of cache tags (`undefined`/empty entries dropped). */
export function uniqueTags(tags: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const tag of tags) {
    if (tag === undefined || tag === null || tag === "" || out.includes(tag)) continue;
    out.push(tag);
  }
  return out;
}
