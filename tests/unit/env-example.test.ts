import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// docs/12 §2.2 — every variable name must appear in .env.example (P1.1 acceptance criterion).
const REQUIRED = [
  "APP_ENV",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_ADMIN_URL",
  "ADMIN_HOST",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "APP_ENCRYPTION_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_PUBLIC",
  "R2_BUCKET_PRIVATE",
  "R2_BUCKET_DOCUMENTS",
  "R2_BUCKET_BACKUPS",
  "NEXT_PUBLIC_MEDIA_BASE_URL",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "EMAIL_ALLOWLIST",
  "EMAIL_TRANSPORT",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET",
  "NEXT_PUBLIC_UMAMI_SRC",
  "NEXT_PUBLIC_UMAMI_WEBSITE_ID",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_AUTH_TOKEN",
  "CRON_SECRET",
  "RUN_SCHEDULER",
  "FX_API_URL",
  "FEATURE_PHONE_OTP",
  "FEATURE_WHATSAPP_CHANNEL",
  "FEATURE_THEME_LIGHT_EDITORIAL",
  "FEATURE_PROVIDER_RAZORPAY",
  "FEATURE_PROVIDER_STRIPE",
  "FEATURE_PROVIDER_PAYPAL",
  "FEATURE_AUTOMATED_PROVISIONING",
  "FEATURE_THREE_HERO",
  "FEATURE_BUNDLES",
  "FEATURE_VENDOR_MARKETPLACE",
  "BACKUP_ENCRYPTION_KEY",
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "VERCEL_PROJECT_ID_STAGING",
  "NEON_API_KEY",
  "NEON_PROJECT_ID",
  "LHCI_GITHUB_APP_TOKEN",
];

describe(".env.example", () => {
  const names = new Set(
    readFileSync(".env.example", "utf8")
      .split("\n")
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => l.split("=")[0]),
  );
  it("contains every documented variable", () => {
    const missing = REQUIRED.filter((n) => !names.has(n));
    expect(missing).toEqual([]);
  });
});
