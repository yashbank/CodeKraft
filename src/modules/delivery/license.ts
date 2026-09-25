/**
 * License key helpers — D-603, docs/09 §5.2, TM-05, PHASE-05 P5.4.
 *
 * Keys are stored AES-256-GCM encrypted (`src/lib/crypto`, `APP_ENCRYPTION_KEY`) in
 * `entitlements.license_key_enc`; the masked form shows only the last four characters and is the
 * only representation that ever reaches a list/view. Emails and notifications carry a dashboard
 * link, never the key (MASTER_SPEC §7 "License key delivery").
 */
import { decrypt, encrypt, type KeyInput } from "@/lib/crypto";

export const LICENSE_KEY_MIN = 8;
export const LICENSE_KEY_MAX = 512;
/** Characters revealed at the end of the masked key (`•••• •••• •••• 4F2A`). */
export const MASK_VISIBLE = 4;
const MASK_GROUP = "••••";

export function encryptLicenseKey(plain: string, key?: KeyInput): string {
  const trimmed = plain.trim();
  if (trimmed.length < LICENSE_KEY_MIN || trimmed.length > LICENSE_KEY_MAX) {
    throw new RangeError(`license key must be ${String(LICENSE_KEY_MIN)}..${String(LICENSE_KEY_MAX)} chars`);
  }
  return encrypt(trimmed, key);
}

export function decryptLicenseKey(token: string, key?: KeyInput): string {
  return decrypt(token, key);
}

/**
 * `•••• •••• •••• 4F2A` — three masked groups plus the last `MASK_VISIBLE` characters of the
 * plaintext (separators stripped first so `ABCD-EF12` → `…EF12`).
 */
export function maskLicenseKey(plain: string): string {
  const compact = plain.replace(/[\s-]/g, "");
  const tail = compact.slice(-MASK_VISIBLE).toUpperCase();
  return `${MASK_GROUP} ${MASK_GROUP} ${MASK_GROUP} ${tail}`;
}

/** Masked view straight from the stored ciphertext (decrypts in memory, returns only the mask). */
export function maskedFromEncrypted(token: string | null, key?: KeyInput): string | null {
  if (token === null || token === "") return null;
  return maskLicenseKey(decryptLicenseKey(token, key));
}
