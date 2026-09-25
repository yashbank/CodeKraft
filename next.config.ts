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
  experimental: {
    serverActions: {
      allowedOrigins: [new URL(siteUrl).host, adminHost],
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
