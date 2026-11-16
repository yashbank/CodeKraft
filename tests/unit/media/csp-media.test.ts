// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

describe("CSP lets uploaded media load from the media host and R2", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("allows images, video/audio, fonts and uploads (connect) from NEXT_PUBLIC_MEDIA_BASE_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "https://media.example.test/public");
    const { buildCsp } = await import("@/middleware");
    const { policy } = buildCsp("n", "h");
    const directive = (name: string) =>
      policy.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
    for (const name of ["img-src", "media-src", "font-src", "connect-src"])
      expect(directive(name), name).toContain("https://media.example.test");
    // The presigned browser PUT goes straight to the R2 S3 endpoint.
    expect(directive("connect-src")).toContain("https://*.r2.cloudflarestorage.com");
    expect(directive("media-src")).toContain("blob:");
    // Scripts and objects stay locked down.
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("script-src")).not.toContain("media.example.test");
  });

  it("frame-src allows only youtube and vimeo player frames for video_embed", async () => {
    const { buildCsp } = await import("@/middleware");
    const { policy } = buildCsp("n", "h");
    const frame = policy.split("; ").find((d) => d.startsWith("frame-src ")) ?? "";
    for (const h of ["https://www.youtube-nocookie.com", "https://player.vimeo.com"])
      expect(frame).toContain(h);
    expect(frame).not.toContain("*");
  });
});
