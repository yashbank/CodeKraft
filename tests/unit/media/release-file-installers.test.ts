// @vitest-environment node
import { describe, expect, it } from "vitest";
import { UPLOAD_RULES } from "@/modules/media/types";
import { validateUploadIntent } from "@/modules/media/validation";

const MB = 1024 * 1024;
const installers: [string, string][] = [
  ["setup.exe", "application/x-msdownload"],
  ["app.msi", "application/x-msi"],
  ["app.dmg", "application/x-apple-diskimage"],
  ["app.pkg", "application/octet-stream"],
  ["App.AppImage", "application/octet-stream"],
  ["app.deb", "application/vnd.debian.binary-package"],
  ["app.zip", "application/zip"],
];

describe("release_file installer uploads", () => {
  it.each(installers)("accepts %s (%s) up to hundreds of MB", (filename, mime) => {
    expect(() =>
      validateUploadIntent({ purpose: "release_file", filename, mime, sizeBytes: 800 * MB }),
    ).not.toThrow();
  });

  it("targets the private bucket", () => {
    expect(UPLOAD_RULES.release_file.visibility).toBe("private");
  });

  it("still rejects installers for public media purposes", () => {
    expect(() =>
      validateUploadIntent({
        purpose: "product_image",
        filename: "setup.exe",
        mime: "application/x-msdownload",
        sizeBytes: MB,
      }),
    ).toThrowError(/forbidden/i);
    expect(() =>
      validateUploadIntent({
        purpose: "product_image",
        filename: "a.png",
        mime: "application/octet-stream",
        sizeBytes: MB,
      }),
    ).toThrowError(/not permitted/i);
  });
});
