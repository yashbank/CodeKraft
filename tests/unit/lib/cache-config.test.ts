// @vitest-environment node
import { describe, expect, it } from "vitest";

import { cacheHeaderRules } from "@/lib/cache-headers";
import nextConfig from "../../../next.config";

const rule = (source: string) => cacheHeaderRules.find((r) => r.source === source);
const cacheControl = (source: string) =>
  rule(source)?.headers.find((h) => h.key === "Cache-Control")?.value;

describe("cache header rules (P15-02)", () => {
  it("public static assets are cacheable with stale-while-revalidate", () => {
    for (const s of ["/brand/:path*", "/images/:path*", "/noise.png"]) {
      expect(cacheControl(s)).toMatch(/^public, max-age=\d{5,}, stale-while-revalidate=\d+$/);
    }
  });

  it("per-user / authenticated API responses stay private and uncached", () => {
    for (const s of [
      "/api/notifications",
      "/api/admin/:path*",
      "/api/auth/:path*",
      "/api/chat",
      "/api/leads",
    ]) {
      expect(cacheControl(s)).toBe("private, no-store");
    }
  });

  it("never touches the media routes owned by P15-01", () => {
    expect(cacheHeaderRules.some((r) => r.source.startsWith("/api/files"))).toBe(false);
  });

  it("wires the rules and a long image cache TTL into next.config", async () => {
    expect(await nextConfig.headers?.()).toEqual(cacheHeaderRules);
    expect(nextConfig.images?.minimumCacheTTL).toBeGreaterThanOrEqual(60 * 60 * 24 * 30);
    expect(nextConfig.images?.deviceSizes?.length).toBeLessThan(8);
    expect(nextConfig.images?.imageSizes?.length).toBeLessThan(8);
    expect(nextConfig.images?.remotePatterns?.length).toBeGreaterThan(0);
  });
});
