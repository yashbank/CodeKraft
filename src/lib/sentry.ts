/** Shared Sentry options and the payload scrubber (docs/12 §8.1, docs/09 TM-23). */
import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SENSITIVE_KEYS =
  /^(cookie|set-cookie|authorization|x-api-key|password|token|secret|license[_-]?key|bank[_-]?details|otp)$/i;

function scrubString(s: string): string {
  return s.replace(EMAIL_RE, "[email]");
}

function scrubObject(input: unknown, depth = 0): unknown {
  if (depth > 6 || input == null) return input;
  if (typeof input === "string") return scrubString(input);
  if (Array.isArray(input)) return input.map((v) => scrubObject(v, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : scrubObject(v, depth + 1);
    }
    return out;
  }
  return input;
}

/** Removes cookies, auth headers, request bodies and email addresses before an event leaves the process. */
export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers)
      event.request.headers = scrubObject(event.request.headers) as Record<string, string>;
    if (event.request.query_string)
      event.request.query_string = scrubString(String(event.request.query_string));
  }
  if (event.user) event.user = { id: event.user.id };
  if (event.message) event.message = scrubString(event.message);
  if (event.exception?.values) {
    for (const v of event.exception.values) if (v.value) v.value = scrubString(v.value);
  }
  if (event.extra) event.extra = scrubObject(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrubObject(event.contexts) as ErrorEvent["contexts"];
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? scrubString(b.message) : b.message,
      data: scrubObject(b.data) as typeof b.data,
    }));
  }
  return event;
}

export const sentryBaseOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  environment: process.env.APP_ENV ?? "local",
  release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_VERSION ?? undefined,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  beforeSend,
};
