import { afterEach, describe, expect, it, vi } from "vitest";

import { type CoverCandidate, pickCovers } from "@/modules/catalog/cover-images";

const row = (over: Partial<CoverCandidate>): CoverCandidate => ({
  productId: "p1",
  kind: "image",
  position: 0,
  alt: "alt",
  mime: "image/png",
  media: { id: "m1", objectKey: "media/2026/10/a.png", visibility: "public" },
  width: 100,
  height: 50,
  blurHash: null,
  ...over,
});

describe("pickCovers (R8-13)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("picks the lowest-position image per product with a public URL", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3004");
    const covers = pickCovers([
      row({ position: 2, media: { id: "m2", objectKey: "b.png", visibility: "public" } }),
      row({ position: 1, media: { id: "m1", objectKey: "a.png", visibility: "public" } }),
      row({ productId: "p2", media: { id: "m3", objectKey: "c.png", visibility: "public" } }),
    ]);
    expect(covers.get("p1")?.mediaId).toBe("m1");
    expect(covers.get("p1")?.url).toBe("http://localhost:3004/api/files/public/a.png");
    expect(covers.get("p2")?.mediaId).toBe("m3");
  });

  it("ignores non-image mimes and breaks position ties toward kind=image", () => {
    const covers = pickCovers([
      row({
        position: 0,
        mime: "video/mp4",
        media: { id: "v", objectKey: "v", visibility: "public" },
      }),
      row({
        position: 1,
        kind: "screenshot",
        media: { id: "s", objectKey: "s", visibility: "public" },
      }),
      row({ position: 1, kind: "image", media: { id: "i", objectKey: "i", visibility: "public" } }),
    ]);
    expect(covers.get("p1")?.mediaId).toBe("i");
  });

  it("uses the private proxy for private media and returns nothing for no rows", () => {
    const covers = pickCovers([
      row({ media: { id: "priv", objectKey: "x", visibility: "private" } }),
    ]);
    expect(covers.get("p1")?.url).toBe("/api/files/private/priv");
    expect(pickCovers([]).size).toBe(0);
  });
});
