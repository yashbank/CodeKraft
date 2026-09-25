/**
 * Redaction of secrets/PII before a diff is stored in `audit_logs` (docs/10 §7 "encrypted fields
 * shown as [redacted]", PHASE-03 P3.1). Key matching is case-insensitive on the normalised
 * (snake/camel) name; any key ending in `_enc` / `Enc` is treated as an encrypted column.
 */

export const REDACTED = "[redacted]";

/** Exact key names (snake_case or camelCase spelling) that are always redacted. */
export const REDACTED_KEYS: readonly string[] = Object.freeze([
  "license_key_enc",
  "payout_bank_details_enc",
  "password",
  "token",
  "secret",
  "access_token",
  "refresh_token",
  "id_token",
  "backup_codes",
  "bank_details",
  "payout_bank_details",
  "account_number",
  "authorization",
  "cookie",
  "set_cookie",
  "api_key",
  "totp_secret",
]);

const MAX_DEPTH = 32;

/** `licenseKeyEnc` → `license_key_enc`, `set-cookie` → `set_cookie`. */
export function normaliseKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

export function isRedactedKey(key: string): boolean {
  const k = normaliseKey(key);
  return REDACTED_KEYS.includes(k) || k.endsWith("_enc");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-copy `value`, replacing the value of every redacted key with `[redacted]`. Dates become
 * ISO strings, `bigint` becomes a string, `undefined` members are dropped, cycles/depth beyond 32
 * levels are cut with `[truncated]`.
 */
export function redact(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH || seen.has(value)) return "[truncated]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1, seen));
  }
  if (!isPlainObject(value)) {
    // Class instances (drizzle rows are plain, but be safe): snapshot own enumerable properties.
    return redact({ ...(value as Record<string, unknown>) }, depth, seen);
  }
  const out: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(value)) {
    if (member === undefined) continue;
    out[key] = isRedactedKey(key) ? REDACTED : redact(member, depth + 1, seen);
  }
  return out;
}
