import { describe, expect, it } from "vitest";

import {
  buildProductMediaUrl,
  canVisitorViewProductMedia,
  classifyGalleryMedia,
} from "@/modules/catalog/media-access";

describe("canVisitorViewProductMedia", () => {
  it("allows presentation on published product", () => {
    expect(canVisitorViewProductMedia([{ kind: "presentation", productStatus: "published" }])).toBe(
      true,
    );
  });
  it("denies drafts, attachments, and no rows", () => {
    expect(canVisitorViewProductMedia([{ kind: "presentation", productStatus: "draft" }])).toBe(
      false,
    );
    expect(canVisitorViewProductMedia([{ kind: "attachment", productStatus: "published" }])).toBe(
      false,
    );
    expect(canVisitorViewProductMedia([])).toBe(false);
  });
});

describe("buildProductMediaUrl", () => {
  const priv = { id: "m1", objectKey: "k.pdf", visibility: "private" };
  it("routes private presentation to product-media route", () => {
    expect(buildProductMediaUrl({ kind: "presentation", embedUrl: null }, priv, "https://c/")).toBe(
      "/api/files/product-media/m1",
    );
  });
  it("keeps admin-only route for other private kinds, public URL for public", () => {
    expect(buildProductMediaUrl({ kind: "attachment", embedUrl: null }, priv, "https://c")).toBe(
      "/api/files/private/m1",
    );
    expect(
      buildProductMediaUrl(
        { kind: "image", embedUrl: null },
        { ...priv, objectKey: "a.png", visibility: "public" },
        "https://c/",
      ),
    ).toBe("https://c/a.png");
  });
});

describe("classifyGalleryMedia", () => {
  it("classifies", () => {
    expect(classifyGalleryMedia({ kind: "image", mime: "image/png", url: "u" })).toBe("image");
    expect(classifyGalleryMedia({ kind: "image", mime: "application/pdf", url: "u" })).toBe(
      "hidden",
    );
    expect(classifyGalleryMedia({ kind: "video_file", mime: "video/mp4", url: "u" })).toBe("video");
    expect(classifyGalleryMedia({ kind: "presentation", mime: "application/pdf", url: "u" })).toBe(
      "pdf",
    );
    expect(classifyGalleryMedia({ kind: "attachment", mime: "application/zip", url: "u" })).toBe(
      "hidden",
    );
  });
});
