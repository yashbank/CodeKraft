// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createUploadIntentSchema } from "@/modules/media/contracts";
import { checkSvgSafe } from "@/modules/media/svg-safety";
import { verifyMagicBytes } from "@/modules/media/sniff";
import { UPLOAD_RULES, maxBytesFor } from "@/modules/media/types";
import { validateUploadIntent } from "@/modules/media/validation";
import {
  FORBIDDEN_UPLOAD_EXTENSIONS,
  UPLOAD_FORMATS,
  acceptFor,
  canonicalMime,
  mimeForFilename,
} from "@/lib/upload-formats";

const MB = 1024 * 1024;
const intent = (filename: string, mime: string, sizeBytes = 1000) => ({
  purpose: "content_media" as const,
  filename,
  mime,
  sizeBytes,
});

describe("shared upload format list", () => {
  it("covers every common format for site content", () => {
    const exts = new Set(UPLOAD_FORMATS.flatMap((f) => f.exts));
    for (const e of [
      "jpg",
      "png",
      "webp",
      "gif",
      "avif",
      "svg",
      "mp4",
      "webm",
      "mov",
      "mp3",
      "wav",
      "ogg",
      "m4a",
      "pdf",
      "docx",
      "xlsx",
      "pptx",
      "zip",
      "txt",
      "csv",
      "json",
      "woff",
      "woff2",
      "ttf",
      "otf",
    ])
      expect(exts.has(e), e).toBe(true);
  });

  it("content_media accepts one MIME for every format in the list", () => {
    const allowed = new Set(UPLOAD_RULES.content_media.mimes);
    for (const f of UPLOAD_FORMATS) {
      if (f.group === "archive" && f.mime !== "application/zip") continue; // zip is the common one; others optional
      expect(allowed.has(f.mime), f.mime).toBe(true);
    }
  });

  it("no format uses an executable or script extension", () => {
    for (const f of UPLOAD_FORMATS)
      for (const e of f.exts) expect(FORBIDDEN_UPLOAD_EXTENSIONS.has(e), e).toBe(false);
    for (const e of ["html", "js", "exe", "php", "sh"])
      expect(FORBIDDEN_UPLOAD_EXTENSIONS.has(e)).toBe(true);
  });

  it("maps browser spellings and empty types by extension", () => {
    expect(canonicalMime("audio/x-wav")).toBe("audio/wav");
    expect(canonicalMime("application/x-zip-compressed")).toBe("application/zip");
    expect(mimeForFilename("clip.MOV")).toBe("video/quicktime");
    expect(mimeForFilename("font.woff2")).toBe("font/woff2");
    expect(mimeForFilename("run.exe")).toBeNull();
    expect(acceptFor("image")).toContain(".svg");
  });

  it("applies the per-format size caps", () => {
    expect(maxBytesFor("content_media", "image/png")).toBe(10 * MB);
    expect(maxBytesFor("content_media", "image/svg+xml")).toBe(1 * MB);
    expect(maxBytesFor("content_media", "video/mp4")).toBe(200 * MB);
    // installers and big archives keep the release_file cap
    expect(maxBytesFor("release_file", "application/zip")).toBe(2048 * MB);
  });
});

describe("content_media intake", () => {
  it.each([
    ["a.jpg", "image/jpeg"],
    ["a.avif", "image/avif"],
    ["a.svg", "image/svg+xml"],
    ["a.mov", "video/quicktime"],
    ["a.mp3", "audio/mpeg"],
    ["a.pdf", "application/pdf"],
    ["a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["a.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["a.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["a.zip", "application/zip"],
    ["a.json", "application/json"],
    ["a.woff2", "font/woff2"],
  ])("accepts %s", (name, mime) => {
    expect(createUploadIntentSchema.safeParse(intent(name, mime)).success).toBe(true);
    expect(() =>
      validateUploadIntent(createUploadIntentSchema.parse(intent(name, mime))),
    ).not.toThrow();
  });

  it("turns an alias MIME into the canonical one", () => {
    const r = createUploadIntentSchema.parse(intent("a.wav", "audio/x-wav"));
    expect(r.mime).toBe("audio/wav");
  });

  it.each([
    ["a.html", "text/html"],
    ["a.js", "text/javascript"],
    ["a.exe", "application/x-msdownload"],
    ["a.php", "application/x-httpd-php"],
  ])("refuses %s", (name, mime) => {
    expect(createUploadIntentSchema.safeParse(intent(name, mime)).success).toBe(false);
  });

  it("refuses oversize files per format (11 MB image, 2 MB svg)", () => {
    expect(createUploadIntentSchema.safeParse(intent("a.png", "image/png", 11 * MB)).success).toBe(
      false,
    );
    expect(
      createUploadIntentSchema.safeParse(intent("a.svg", "image/svg+xml", 2 * MB)).success,
    ).toBe(false);
  });

  it("SVG is refused for every other purpose and for a mismatched name", () => {
    for (const purpose of ["product_image", "avatar", "site_logo", "chat_attachment"] as const)
      expect(
        createUploadIntentSchema.safeParse({ ...intent("a.svg", "image/svg+xml"), purpose })
          .success,
      ).toBe(false);
    expect(() =>
      validateUploadIntent({ ...intent("a.png", "image/svg+xml"), purpose: "content_media" }),
    ).toThrow();
  });
});

describe("SVG safety check", () => {
  const ok =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#123"/></svg>';
  it("accepts a plain drawing", () => {
    expect(checkSvgSafe(ok).ok).toBe(true);
    expect(checkSvgSafe(`<?xml version="1.0"?>${ok}`).ok).toBe(true);
  });
  it("accepts internal references", () => {
    expect(
      checkSvgSafe(
        '<svg><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/><use href="#g"/></svg>',
      ).ok,
    ).toBe(true);
  });
  it.each([
    ["script", "<svg><script>alert(1)</script></svg>"],
    ["event handler", '<svg onload="alert(1)"></svg>'],
    ["foreignObject", "<svg><foreignObject><div/></foreignObject></svg>"],
    ["javascript link", '<svg><a href="javascript:alert(1)"><text/></a></svg>'],
    ["external image", '<svg><image href="https://evil.test/x.png"/></svg>'],
    ["external url()", '<svg><rect fill="url(https://evil.test/p)"/></svg>'],
    ["entity", '<!DOCTYPE svg [<!ENTITY x "y">]><svg>&x;</svg>'],
    ["import", "<svg><style>@import 'https://evil.test/a.css';</style></svg>"],
    ["not an svg", "<html><body>hi</body></html>"],
  ])("rejects %s", (_n, svg) => {
    expect(checkSvgSafe(svg).ok).toBe(false);
  });
});

describe("magic bytes for the new formats", () => {
  it("accepts matching bytes", () => {
    expect(verifyMagicBytes(Buffer.from("wOF2\0\0\0\0"), "font/woff2").ok).toBe(true);
    expect(verifyMagicBytes(Buffer.from("ID3\x03\0\0\0\0\0\0"), "audio/mpeg").ok).toBe(true);
    expect(verifyMagicBytes(Buffer.from("RIFF\x24\0\0\0WAVEfmt "), "audio/wav").ok).toBe(true);
    expect(verifyMagicBytes(Buffer.from("\0\0\0\x14ftypqt  \0\0\0\0"), "video/quicktime").ok).toBe(
      true,
    );
    expect(
      verifyMagicBytes(
        Buffer.from([0x50, 0x4b, 3, 4, 0, 0]),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ).ok,
    ).toBe(true);
    expect(verifyMagicBytes(Buffer.from('{"a":1}'), "application/json").ok).toBe(true);
    expect(
      verifyMagicBytes(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/svg+xml")
        .ok,
    ).toBe(true);
  });

  it("still blocks markup and binaries", () => {
    expect(verifyMagicBytes(Buffer.from("<html><svg/></html>"), "image/svg+xml").ok).toBe(false);
    expect(verifyMagicBytes(Buffer.from("<svg/>"), "text/plain").ok).toBe(false);
    expect(verifyMagicBytes(Buffer.from([0x4d, 0x5a, 0x90, 0]), "image/svg+xml").ok).toBe(false);
    expect(verifyMagicBytes(Buffer.from("not a font at all"), "font/woff2").ok).toBe(false);
  });
});
