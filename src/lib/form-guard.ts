/**
 * Invisible bot protection for public forms (replaces Cloudflare Turnstile).
 *  - Honeypot: a hidden field real users never fill; any value => bot.
 *  - Time trap: a server-signed render timestamp; submissions < MIN_FILL_MS after it are bots.
 * Honeypot / forged-token submissions are silently accepted-and-dropped (callers return a
 * normal-looking success and store nothing) so bots get no signal to adapt to. A too-fast
 * submission with a valid token may be a real person (password-manager autofill), so callers
 * return the retryable `TOO_FAST_MESSAGE` (HTTP 429) and store nothing.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const MIN_FILL_MS = 2000;
export const TOO_FAST_MESSAGE = "Please wait a moment and try again.";
const FUTURE_SKEW_MS = 5000;

function secret(): string {
  return process.env.BETTER_AUTH_SECRET ?? "ck-local-form-guard-secret";
}

function sign(ts: string): string {
  return createHmac("sha256", `form-guard:${secret()}`).update(ts).digest("hex");
}

/** `<epoch-ms>.<hmac>` stamped when the form is rendered. Old tokens are fine (tab left open). */
export function issueFormToken(now: number = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts)}`;
}

export interface FormGuardInput {
  /** Value of the hidden honeypot field. */
  honeypot?: unknown;
  /** Token from `issueFormToken`. */
  token?: unknown;
}

export type FormGuardVerdict = "ok" | "honeypot" | "too_fast" | "bad_token";

export function checkFormGuard(input: FormGuardInput, now: number = Date.now()): FormGuardVerdict {
  const hp = input.honeypot;
  if (typeof hp === "string" ? hp.trim().length > 0 : Boolean(hp)) return "honeypot";
  if (typeof input.token !== "string") return "bad_token";
  const dot = input.token.indexOf(".");
  if (dot <= 0) return "bad_token";
  const ts = input.token.slice(0, dot);
  const a = Buffer.from(input.token.slice(dot + 1));
  const b = Buffer.from(sign(ts));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "bad_token";
  const issued = Number(ts);
  if (!Number.isFinite(issued) || issued > now + FUTURE_SKEW_MS) return "bad_token";
  if (now - issued < MIN_FILL_MS) return "too_fast";
  return "ok";
}
