// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  getFileExtension,
  isCustomerPurpose,
  validateEmbedUrl,
  validateUploadIntent,
} from "@/modules/media/validation";

describe("media validation (docs/06 §3.5, docs/09 TM-12, PHASE-03 P3.5)", () => {
  it("rejects .svg files for images and all upload purposes", () => {
    expect(() =>
      validateUploadIntent({
        purpose: "product_image",
        filename: "malicious.svg",
        mime: "image/svg+xml",
        sizeBytes: 1024,
      }),
    ).toThrowError(/forbidden/i);

    expect(() =>
      validateUploadIntent({
        purpose: "avatar",
        filename: "vector.SVG",
        mime: "image/svg+xml",
        sizeBytes: 500,
      }),
    ).toThrowError(/forbidden/i);
  });

  it("rejects dangerous script and executable extensions", () => {
    const dangerous = ["payload.html", "script.js", "setup.exe", "test.sh", "index.php"];
    for (const f of dangerous) {
      expect(() =>
        validateUploadIntent({
          purpose: "product_attachment",
          filename: f,
          mime: "text/plain",
          sizeBytes: 2048,
        }),
      ).toThrowError(/forbidden/i);
    }
  });

  it("enforces per-purpose size caps", () => {
    const MB = 1024 * 1024;

    // product_image cap is 10 MB
    expect(() =>
      validateUploadIntent({
        purpose: "product_image",
        filename: "large.jpg",
        mime: "image/jpeg",
        sizeBytes: 11 * MB,
      }),
    ).toThrowError(/exceeds maximum allowed/i);

    // 10 MB is allowed
    expect(() =>
      validateUploadIntent({
        purpose: "product_image",
        filename: "valid.jpg",
        mime: "image/jpeg",
        sizeBytes: 10 * MB,
      }),
    ).not.toThrow();

    // product_presentation cap is 25 MB
    expect(() =>
      validateUploadIntent({
        purpose: "product_presentation",
        filename: "pitch.pdf",
        mime: "application/pdf",
        sizeBytes: 26 * MB,
      }),
    ).toThrowError(/exceeds maximum allowed/i);

    // release_file cap is 2048 MB (2 GB)
    expect(() =>
      validateUploadIntent({
        purpose: "release_file",
        filename: "build.zip",
        mime: "application/zip",
        sizeBytes: 2049 * MB,
      }),
    ).toThrowError(/exceeds maximum allowed/i);
  });

  it("validates embed URL hosts against allowed list (YouTube and Vimeo only)", () => {
    expect(() => validateEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).not.toThrow();
    expect(() => validateEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).not.toThrow();
    expect(() => validateEmbedUrl("https://vimeo.com/123456789")).not.toThrow();
    expect(() => validateEmbedUrl("https://player.vimeo.com/video/123456789")).not.toThrow();

    // Insecure protocol
    expect(() => validateEmbedUrl("http://youtube.com/watch?v=123")).toThrowError(/https/i);

    // Disallowed domain
    expect(() => validateEmbedUrl("https://evil.com/video")).toThrowError(
      /only youtube and vimeo/i,
    );
    expect(() => validateEmbedUrl("https://dailymotion.com/video/123")).toThrowError(
      /only youtube and vimeo/i,
    );
  });

  it("identifies customer upload purposes vs admin-only purposes", () => {
    expect(isCustomerPurpose("query_attachment")).toBe(true);
    expect(isCustomerPurpose("avatar")).toBe(true);
    expect(isCustomerPurpose("product_image")).toBe(false);
    expect(isCustomerPurpose("release_file")).toBe(false);
    expect(isCustomerPurpose("expense_receipt")).toBe(false);
  });

  it("correctly extracts lower-case file extension", () => {
    expect(getFileExtension("photo.PNG")).toBe("png");
    expect(getFileExtension("archive.tar.gz")).toBe("gz");
    expect(getFileExtension("noextension")).toBe("");
  });
});
