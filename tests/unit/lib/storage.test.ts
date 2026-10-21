import { describe, it, expect, afterEach, vi } from "vitest";
import { getPublicMediaBaseUrl } from "@/lib/storage";

describe("getPublicMediaBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the env var when it is a public URL", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "https://media.codekraft.dev");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codekraft.dev");
    expect(getPublicMediaBaseUrl()).toBe("https://media.codekraft.dev");
  });

  it("falls back to proxy when env is a private R2 endpoint", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_MEDIA_BASE_URL",
      "https://abc123.r2.cloudflarestorage.com/codekraft-public",
    );
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codekraft.dev");
    expect(getPublicMediaBaseUrl()).toBe("https://codekraft.dev/api/files/public");
  });

  it("falls back to proxy when env is an S3 endpoint", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "https://bucket.s3.amazonaws.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codekraft.dev");
    expect(getPublicMediaBaseUrl()).toBe("https://codekraft.dev/api/files/public");
  });

  it("falls back to relative proxy when no site URL", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(getPublicMediaBaseUrl()).toBe("/api/files/public");
  });

  it("uses site URL proxy when no media base is set", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codekraft.dev");
    expect(getPublicMediaBaseUrl()).toBe("https://codekraft.dev/api/files/public");
  });
});
