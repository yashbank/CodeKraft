import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const adminHost = process.env.ADMIN_HOST ?? "admin.localhost:3000";
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
if (mediaBase) {
  const u = new URL(mediaBase);
  remotePatterns.push({
    protocol: u.protocol.replace(":", "") as "http" | "https",
    hostname: u.hostname,
    pathname: "/**",
  });
}

const nextConfig: NextConfig = {
  output: "standalone",
  // Native / worker-thread packages must not be bundled (pino transports, argon2)
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "argon2", "embedded-postgres"],
  reactStrictMode: true,
  poweredByHeader: false,
  images: { remotePatterns, formats: ["image/avif", "image/webp"] },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [new URL(siteUrl).host, adminHost],
      bodySizeLimit: "2mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  // Source-map upload only when the CI token exists (docs/12 §2.2 SENTRY_AUTH_TOKEN, C-only)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: false,
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
    excludeTracing: true,
  },
});
