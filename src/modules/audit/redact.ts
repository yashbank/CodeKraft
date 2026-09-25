/**
 * Audit redaction (docs/06 §1.6, docs/10 §7, PHASE-03 P3.1).
 * Redacts secrets, encrypted fields, passwords, and tokens as `[redacted]`.
 */

export const REDACTED_PLACEHOLDER = "[redacted]";

const SENSITIVE_KEY_PATTERN =
  /^(?:license_key_enc|payout_bank_details_enc|password|token|secret|api_key|apiKey|bank_details_enc|access_token|refresh_token|private_key)$/i;

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Deeply redacts sensitive keys in any object or array.
 */
export function redactSensitive<T>(val: T): T {
  if (val === null || val === undefined) return val;

  if (Array.isArray(val)) {
    return val.map((item) => redactSensitive(item)) as unknown as T;
  }

  if (isPlainObject(val)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(val)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = REDACTED_PLACEHOLDER;
      } else {
        out[key] = redactSensitive(v);
      }
    }
    return out as T;
  }

  return val;
}
