/**
 * Structured logging — docs/12 §8.2, docs/09 §10.
 *
 * pino, JSON lines to stdout, `pino-pretty` only for `APP_ENV=local` outside test runs. The
 * redact list covers credentials, tokens, cookies, license keys, bank details and email bodies at
 * the top level and one level down (`*.`), plus the usual `req`/`res` header paths. Never log
 * request bodies of auth/checkout/payment actions, chat text, presigned URLs or model prompts.
 */
import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

const SENSITIVE_KEYS = [
  "password",
  "newPassword",
  "currentPassword",
  "token",
  "secret",
  "authorization",
  "cookie",
  '["set-cookie"]',
  "licenseKey",
  "license_key",
  "bankDetails",
  "bank_details",
  "bank",
  "account_number",
  "accountNumber",
  "ifsc",
  "upi",
  "otp",
  "apiKey",
  "api_key",
  '["x-api-key"]',
  "presignedUrl",
  "presigned_url",
] as const;

const EMAIL_BODY_PATHS = ["email.html", "email.text", "email.body", "mail.html", "mail.text"];

/** pino `redact` paths (docs/12 §8.2). Exported so P1.8's Sentry scrubber can reuse the keys. */
export const REDACT_PATHS: readonly string[] = Object.freeze([
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((k) => (k.startsWith("[") ? `*${k}` : `*.${k}`)),
  "req.headers.cookie",
  "req.headers.authorization",
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  "url.query.token",
  "query.token",
  ...EMAIL_BODY_PATHS,
  ...EMAIL_BODY_PATHS.map((p) => `*.${p}`),
]);

export const REDACTED = "[Redacted]";

const LEVELS = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

function isTestRun(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST !== undefined;
}

export interface CreateLoggerOptions {
  level?: string;
  /** Force or suppress the pretty transport (default: `APP_ENV=local` and not a test run). */
  pretty?: boolean;
  /** Write here instead of stdout (tests). Incompatible with `pretty`. */
  destination?: DestinationStream;
  base?: Record<string, unknown>;
}

export function resolveLevel(raw: string | undefined): string {
  const level = raw?.trim().toLowerCase();
  return level !== undefined && LEVELS.has(level) ? level : "info";
}

export function createLogger(opts: CreateLoggerOptions = {}): Logger {
  const appEnv = process.env.APP_ENV ?? "local";
  const pretty = opts.pretty ?? (appEnv === "local" && !isTestRun());
  const options: LoggerOptions = {
    level: opts.level ?? resolveLevel(process.env.LOG_LEVEL),
    redact: { paths: [...REDACT_PATHS], censor: REDACTED },
    base: { env: appEnv, ...opts.base },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  if (opts.destination !== undefined) return pino(options, opts.destination);
  if (pretty) {
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname,env" },
      },
    });
  }
  return pino(options);
}

let root: Logger | undefined;

/** Process-wide logger (lazy so env/transport are resolved on first use, not at import). */
export function getLogger(): Logger {
  root ??= createLogger();
  return root;
}

/** Child logger carrying the request id (docs/12 §8.2 field `requestId`). */
export function withRequestId(requestId: string, bindings: Record<string, unknown> = {}): Logger {
  return getLogger().child({ requestId, ...bindings });
}

/** Module-scoped child, e.g. `moduleLogger("finance")`. */
export function moduleLogger(module: string): Logger {
  return getLogger().child({ module });
}

/** Lazy proxy so `logger.info(...)` works without an explicit `getLogger()` call. */
export const logger: Logger = new Proxy({} as Logger, {
  get(_target, prop) {
    const real = getLogger();
    return Reflect.get(real, prop, real) as unknown;
  },
});
