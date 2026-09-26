/**
 * Environment validation — docs/12 §1 (production guards), §2.2 (variables), docs/09 §8.
 *
 * Every variable of `.env.example` has a Zod entry. `parseEnv` is pure (takes a raw record) so
 * the guards are unit-testable; `getEnv()` parses `process.env` once and memoises. Server-only:
 * importing this module in the browser throws so no secret can be bundled by accident.
 */
import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error("src/lib/env.ts is server-only and must not be imported in the browser");
}

export const APP_ENVS = ["local", "preview", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const EMAIL_TRANSPORTS = ["log", "outbox", "resend"] as const;
export type EmailTransport = (typeof EMAIL_TRANSPORTS)[number];

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export class EnvError extends Error {
  constructor(
    message: string,
    readonly issues: readonly string[],
  ) {
    super(message);
    this.name = "EnvError";
  }
}

/** Absolute http(s) URL, trailing slash stripped (`NEXT_PUBLIC_SITE_URL` rule of docs/12 §2.2). */
const httpUrl = z.url({ protocol: /^https?$/ }).transform((u) => u.replace(/\/+$/, ""));

const postgresUrl = z.string().regex(/^postgres(ql)?:\/\/\S+$/, "must be a postgres:// URL");

/** `true`/`1`/`yes`/`on` → true, `false`/`0`/`no`/`off` → false; unset → undefined. */
const booleanish = z
  .string()
  .optional()
  .transform((raw, ctx) => {
    if (raw === undefined) return undefined;
    const v = raw.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
    ctx.addIssue({ code: "custom", message: `expected true/false, got ${JSON.stringify(raw)}` });
    return z.NEVER;
  });

/** Comma-separated list, trimmed, empties dropped. */
const csv = z
  .string()
  .optional()
  .transform((raw) =>
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

const optionalString = z.string().min(1).optional();
const bucket = z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "invalid bucket name");

/** Zod schema for `.env.example` (docs/12 §2.2). Empty strings are treated as unset. */
export const envSchema = z
  .object({
    // Core
    APP_ENV: z.enum(APP_ENVS).default("local"),
    NEXT_PUBLIC_SITE_URL: httpUrl,
    NEXT_PUBLIC_ADMIN_URL: httpUrl,
    ADMIN_HOST: z.string().min(1),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    // Database
    DATABASE_URL: postgresUrl,
    DATABASE_URL_UNPOOLED: postgresUrl.optional(),
    // Auth
    BETTER_AUTH_SECRET: optionalString,
    BETTER_AUTH_URL: httpUrl.optional(),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    APP_ENCRYPTION_KEY: optionalString,
    // Storage
    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    R2_BUCKET_PUBLIC: bucket,
    R2_BUCKET_PRIVATE: bucket,
    R2_BUCKET_DOCUMENTS: bucket,
    R2_BUCKET_BACKUPS: bucket,
    NEXT_PUBLIC_MEDIA_BASE_URL: httpUrl.optional(),
    // Email
    RESEND_API_KEY: optionalString,
    RESEND_WEBHOOK_SECRET: optionalString,
    EMAIL_FROM: z.string().min(1),
    EMAIL_REPLY_TO: optionalString,
    EMAIL_ALLOWLIST: csv,
    EMAIL_TRANSPORT: z.enum(EMAIL_TRANSPORTS).default("log"),
    // AI
    ANTHROPIC_API_KEY: optionalString,
    // Forms
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
    TURNSTILE_SECRET: optionalString,
    // Analytics
    NEXT_PUBLIC_UMAMI_SRC: httpUrl.optional(),
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: optionalString,
    // Observability
    NEXT_PUBLIC_SENTRY_DSN: httpUrl.optional(),
    SENTRY_ORG: optionalString,
    SENTRY_PROJECT: optionalString,
    SENTRY_AUTH_TOKEN: optionalString,
    // Jobs
    CRON_SECRET: optionalString,
    RUN_SCHEDULER: booleanish.transform((v) => v ?? false),
    FX_API_URL: httpUrl.default("https://open.er-api.com/v6/latest"),
    // Feature flags (docs/13 §6); unset = DB value wins (see lib/feature-flags)
    FEATURE_PHONE_OTP: booleanish,
    FEATURE_WHATSAPP_CHANNEL: booleanish,
    FEATURE_THEME_LIGHT_EDITORIAL: booleanish,
    FEATURE_PROVIDER_RAZORPAY: booleanish,
    FEATURE_PROVIDER_STRIPE: booleanish,
    FEATURE_PROVIDER_PAYPAL: booleanish,
    FEATURE_AUTOMATED_PROVISIONING: booleanish,
    FEATURE_THREE_HERO: booleanish,
    FEATURE_BUNDLES: booleanish,
    FEATURE_VENDOR_MARKETPLACE: booleanish,
    // CI-only
    BACKUP_ENCRYPTION_KEY: optionalString,
    VERCEL_TOKEN: optionalString,
    VERCEL_ORG_ID: optionalString,
    VERCEL_PROJECT_ID: optionalString,
    VERCEL_PROJECT_ID_STAGING: optionalString,
    NEON_API_KEY: optionalString,
    NEON_PROJECT_ID: optionalString,
    LHCI_GITHUB_APP_TOKEN: optionalString,
  })
  .transform((e) => ({
    ...e,
    DATABASE_URL_UNPOOLED: e.DATABASE_URL_UNPOOLED ?? e.DATABASE_URL,
    BETTER_AUTH_URL: e.BETTER_AUTH_URL ?? e.NEXT_PUBLIC_SITE_URL,
  }))
  .superRefine((e, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (e.APP_ENV !== "local" && e.BETTER_AUTH_SECRET === undefined) {
      issue("BETTER_AUTH_SECRET", "required outside local");
    }
    if (e.APP_ENV !== "production" && e.EMAIL_TRANSPORT === "resend") {
      // P1.8 risk: real sends outside production must be allow-listed.
      if (e.EMAIL_ALLOWLIST.length === 0) {
        issue(
          "EMAIL_ALLOWLIST",
          "must list recipients when EMAIL_TRANSPORT=resend outside production",
        );
      }
    }
    if (e.APP_ENV !== "production") return;

    // docs/12 §1: production never shares a bucket or a database with another environment.
    for (const key of [
      "R2_BUCKET_PUBLIC",
      "R2_BUCKET_PRIVATE",
      "R2_BUCKET_DOCUMENTS",
      "R2_BUCKET_BACKUPS",
    ] as const) {
      if (/-dev-|-dev$|-staging-|-staging$/.test(e[key])) {
        issue(key, `production must not use bucket ${e[key]}`);
      }
    }
    for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const) {
      if (/-dev\b|localhost|127\.0\.0\.1|-staging\b|-preview\b/.test(e[key])) {
        issue(key, "production must connect to the Neon main branch (no dev/local/staging host)");
      }
    }
    if ((e.BETTER_AUTH_SECRET ?? "").length < 32) {
      issue("BETTER_AUTH_SECRET", "must be at least 32 characters in production");
    }
    if (e.APP_ENCRYPTION_KEY === undefined) issue("APP_ENCRYPTION_KEY", "required in production");
    if (e.CRON_SECRET === undefined) issue("CRON_SECRET", "required in production");
    if (e.EMAIL_TRANSPORT !== "resend" && process.env.ALLOW_LOG_EMAIL !== "true") {
      issue("EMAIL_TRANSPORT", "must be `resend` in production");
    }
    if (e.EMAIL_TRANSPORT === "resend" && e.RESEND_API_KEY === undefined) {
      issue("RESEND_API_KEY", "required in production");
    }
  });

export type Env = z.infer<typeof envSchema>;
export type RawEnv = Record<string, string | undefined>;

/** Aliases accepted for `APP_ENV` (the test harness sets `test`; it behaves like `local`). */
const APP_ENV_ALIASES: Readonly<Record<string, AppEnv>> = Object.freeze({
  test: "local",
  development: "local",
});

function normalise(raw: RawEnv): RawEnv {
  const out: RawEnv = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    const trimmed = value.trim();
    if (trimmed === "") continue; // empty in .env.example / Vercel means unset
    out[key] = trimmed;
  }
  const appEnv = out.APP_ENV;
  if (appEnv !== undefined && appEnv in APP_ENV_ALIASES) {
    out.APP_ENV = APP_ENV_ALIASES[appEnv];
  }
  return out;
}

/** Pure: validate a raw record (e.g. `process.env`) or throw `EnvError` listing every issue. */
export function parseEnv(raw: RawEnv): Env {
  const result = envSchema.safeParse(normalise(raw));
  if (result.success) return result.data;
  const issues = result.error.issues.map(
    (i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`,
  );
  throw new EnvError(`Invalid environment:\n  - ${issues.join("\n  - ")}`, issues);
}

let cached: Env | undefined;

/** Lazy, memoised `process.env` parse. Throws `EnvError` on first use when misconfigured. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Drop the memoised value (tests, or after mutating `process.env` in scripts). */
export function resetEnvCache(): void {
  cached = undefined;
}

export function isProduction(): boolean {
  return getEnv().APP_ENV === "production";
}
