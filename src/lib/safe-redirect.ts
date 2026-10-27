/**
 * Post-login redirect target validation: same-origin relative paths only (no open redirect).
 * Rejects absolute URLs, protocol-relative `//host`, backslash tricks and control characters.
 */
export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  // Defence in depth: re-check after percent-decoding (%2F%2F, %5C) in case a downstream hop decodes.
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(decoded)) return fallback;
  return value;
}
