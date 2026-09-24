/**
 * Field-level encryption and token hashing — docs/09 §5.2, docs/12 §8.3.
 *
 * AES-256-GCM with `APP_ENCRYPTION_KEY` (32 bytes, base64; hex accepted). Output is
 * `v1:<iv_b64>:<tag_b64>:<cipher_b64>`; the version prefix selects the key from a key ring so
 * rotation is "add `v2:`, re-encrypt rows, drop `v1:`".
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const CURRENT_KEY_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const TOKEN_RE = /^(v\d+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]*)$/;

export type KeyRing = Readonly<Record<string, Buffer>>;
export type KeyInput = string | Buffer | KeyRing;

export class CryptoError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CryptoError";
  }
}

/** Decode a 32-byte key given as base64 (standard or url-safe) or 64 hex characters. */
export function decodeKey(raw: string): Buffer {
  const text = raw.trim();
  const buf = /^[0-9a-fA-F]{64}$/.test(text)
    ? Buffer.from(text, "hex")
    : Buffer.from(text, /[-_]/.test(text) ? "base64url" : "base64");
  if (buf.length !== KEY_BYTES) {
    throw new CryptoError(`encryption key must be ${String(KEY_BYTES)} bytes (base64 or hex)`);
  }
  return buf;
}

/** Fresh random key in the `.env` format (base64, 32 bytes). */
export function generateKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

function isKeyRing(value: KeyInput): value is KeyRing {
  return typeof value !== "string" && !Buffer.isBuffer(value);
}

function ringFrom(input: KeyInput | undefined): KeyRing {
  if (input === undefined) {
    const raw = process.env.APP_ENCRYPTION_KEY;
    if (raw === undefined || raw === "") throw new CryptoError("APP_ENCRYPTION_KEY is not set");
    return { [CURRENT_KEY_VERSION]: decodeKey(raw) };
  }
  if (isKeyRing(input)) return input;
  return { [CURRENT_KEY_VERSION]: typeof input === "string" ? decodeKey(input) : input };
}

function keyFor(ring: KeyRing, version: string): Buffer {
  const key = ring[version];
  if (key === undefined) throw new CryptoError(`no encryption key for version ${version}`);
  if (key.length !== KEY_BYTES) throw new CryptoError("encryption key has the wrong length");
  return key;
}

/** Encrypt UTF-8 text or bytes → `v1:<iv>:<tag>:<ciphertext>` (all base64). */
export function encrypt(
  plain: string | Buffer,
  key?: KeyInput,
  version: string = CURRENT_KEY_VERSION,
): string {
  const k = keyFor(ringFrom(key), version);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, k, iv, { authTagLength: TAG_BYTES });
  const data = typeof plain === "string" ? Buffer.from(plain, "utf8") : plain;
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${version}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** Decrypt a token produced by `encrypt`; throws `CryptoError` on wrong key, tampering or format. */
export function decryptToBuffer(token: string, key?: KeyInput): Buffer {
  const m = TOKEN_RE.exec(token);
  if (m === null) throw new CryptoError("malformed ciphertext token");
  const [, version, ivB64, tagB64, dataB64] = m as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];
  const k = keyFor(ringFrom(key), version);
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new CryptoError("malformed ciphertext token");
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, k, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  } catch (cause) {
    throw new CryptoError("decryption failed (wrong key or tampered data)", { cause });
  }
}

export function decrypt(token: string, key?: KeyInput): string {
  return decryptToBuffer(token, key).toString("utf8");
}

export function isEncryptedToken(value: string): boolean {
  return TOKEN_RE.test(value);
}

/** SHA-256 hex digest for storing one-time tokens (verification, reset, upload intents). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time string comparison independent of input lengths. */
export function safeEqual(a: string, b: string): boolean {
  const da = createHash("sha256").update(a, "utf8").digest();
  const db = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(da, db) && a.length === b.length;
}
